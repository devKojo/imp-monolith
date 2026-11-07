import {
  EmailNotVerifiedError,
  WrongPortalError,
  ForbiddenError,
  InvalidCredentialsError,
  InvalidTokenError,
  OAuthFailedError,
  UnauthenticatedError,
  WeakPasswordError,
} from '../domain/errors';
import { normalizeEmail } from '../domain/email';
import { newOAuthAttempt, openAttempt, sealAttempt } from '../domain/oauth';
import { isLocked } from '../domain/login-throttle';
import { passwordProblems } from '../domain/password-policy';
import { absoluteExpiry, isSessionActive, shouldTouch } from '../domain/session-policy';
import { csrfTokenFor, generateToken, hashToken } from '../domain/tokens';
import { uuidv7 } from '@/shared/uuid';
import type {
  AccountType,
  BreachedPasswordChecker,
  Clock,
  GoogleIdentityProvider,
  IdentityRepository,
  LoginRateLimiter,
  Mailer,
  MembershipSummary,
  PasswordHasher,
  SessionRecord,
} from './ports';

export type AuthDeps = {
  repo: IdentityRepository;
  hasher: PasswordHasher;
  breached: BreachedPasswordChecker;
  mailer: Mailer;
  /** Present only when Google sign-in is configured. */
  google?: GoogleIdentityProvider | undefined;
  loginLimiter: LoginRateLimiter;
  registerLimiter: LoginRateLimiter;
  /** Resend: per client IP (hourly), per address (hourly) and per address (short cooldown). */
  resendIpLimiter: LoginRateLimiter;
  resendEmailLimiter: LoginRateLimiter;
  resendCooldown: LoginRateLimiter;
  csrfSecret: string;
  clock?: Clock;
};

export type AuthContext = {
  sessionId: string;
  userId: string;
  accountType: AccountType;
  email: string;
  name: string;
  emailVerified: boolean;
  active: SessionRecord['active'];
  csrfToken: string;
};

export type IssuedSession = {
  /** Opaque token for the __Host-sid cookie. */
  token: string;
  /** Absolute expiry, for the cookie Max-Age. */
  expiresAt: Date;
  csrfToken: string;
};

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  private readonly now: Clock;

  constructor(private readonly deps: AuthDeps) {
    this.now = deps.clock ?? (() => new Date());
  }

  /**
   * Responds identically whether or not the email is already registered (no account
   * enumeration). The password is hashed first so both paths cost the same.
   */
  /** Shared by both registration flows: throttle, normalise, and vet + hash the password. */
  private async prepareRegistration(input: { email: string; password: string; ip: string }) {
    this.deps.registerLimiter.assertAllowed(input.ip);
    this.deps.registerLimiter.recordFailure(input.ip); // counts every attempt

    const email = normalizeEmail(input.email);
    const problems = passwordProblems(input.password, email);
    if (problems.length === 0 && (await this.deps.breached.isBreached(input.password))) {
      problems.push('has appeared in a known data breach; choose a different password');
    }
    if (problems.length > 0) throw new WeakPasswordError(problems);

    return { email, passwordHash: await this.deps.hasher.hash(input.password) };
  }

  /** Participant account: an identity only. No business, no membership (ADR-P001). */
  async registerParticipant(input: {
    name: string;
    email: string;
    password: string;
    agreementVersion: string;
    ip: string;
  }): Promise<void> {
    const { email, passwordHash } = await this.prepareRegistration(input);
    // No verification email and no verification gate: a participant can sign in straight away and
    // may verify the address later from their account (sendOwnVerification). Same result whether
    // or not the address already existed, so the response reveals nothing (UI-CPY-03).
    await this.deps.repo.registerParticipant({
      userId: uuidv7(this.now().getTime()),
      email,
      name: input.name.trim(),
      passwordHash,
      agreementVersion: input.agreementVersion,
    });
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    agreementVersion: string;
    ip: string;
  }): Promise<void> {
    const { email, passwordHash } = await this.prepareRegistration(input);
    const now = this.now();
    const verificationToken = generateToken();
    const result = await this.deps.repo.registerOwner({
      userId: uuidv7(now.getTime()),
      tenantId: uuidv7(now.getTime()),
      membershipId: uuidv7(now.getTime()),
      email,
      name: input.name.trim(),
      passwordHash,
      businessName: input.businessName.trim(),
      agreementVersion: input.agreementVersion,
      verificationTokenHash: hashToken(verificationToken),
      verificationExpiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
    });
    if (result === 'created')
      await this.deps.mailer.sendVerificationEmail(email, verificationToken);
  }

  /**
   * Sends another verification link to an address that registered but never verified. The caller
   * always gets the same answer, whether or not the address has an account, so this cannot be used
   * to find out who is registered (UI-CPY-03). Limits are keyed on the address string itself, so
   * they apply identically to unknown addresses. The mail is sent in the background so response
   * time does not reveal whether anything was sent.
   */
  async resendVerification(input: { email: string; ip: string }): Promise<void> {
    const email = normalizeEmail(input.email);
    const {
      resendIpLimiter: ip,
      resendEmailLimiter: perEmail,
      resendCooldown: cooldown,
    } = this.deps;
    ip.assertAllowed(input.ip);
    cooldown.assertAllowed(email);
    perEmail.assertAllowed(email);
    ip.recordFailure(input.ip);
    cooldown.recordFailure(email);
    perEmail.recordFailure(email);

    const user = await this.deps.repo.findLoginUser(email);
    if (!user || user.emailVerifiedAt) return;
    const now = this.now();
    const token = generateToken();
    await this.deps.repo.createEmailVerification(
      user.id,
      hashToken(token),
      new Date(now.getTime() + VERIFICATION_TTL_MS),
    );
    void this.deps.mailer.sendVerificationEmail(email, token).catch(() => {
      // Never log the address (R-PRV-06); the failure is visible as a missing email and a warning.
      console.warn('[mail] resend verification email failed');
    });
  }

  /**
   * A signed-in person asks for a verification link for their own address (optional for
   * participants). Same limits as the public resend, keyed on their address and IP; the mail is
   * awaited here because the caller is authenticated and can be told it failed.
   */
  async sendOwnVerification(
    ctx: AuthContext,
    ip: string,
  ): Promise<{ status: 'sent' | 'already_verified' }> {
    if (ctx.emailVerified) return { status: 'already_verified' };
    const email = normalizeEmail(ctx.email);
    const {
      resendIpLimiter: ipLimit,
      resendEmailLimiter: perEmail,
      resendCooldown: cooldown,
    } = this.deps;
    ipLimit.assertAllowed(ip);
    cooldown.assertAllowed(email);
    perEmail.assertAllowed(email);
    ipLimit.recordFailure(ip);
    cooldown.recordFailure(email);
    perEmail.recordFailure(email);
    const token = generateToken();
    await this.deps.repo.createEmailVerification(
      ctx.userId,
      hashToken(token),
      new Date(this.now().getTime() + VERIFICATION_TTL_MS),
    );
    await this.deps.mailer.sendVerificationEmail(email, token);
    return { status: 'sent' };
  }

  async verifyEmail(token: string): Promise<void> {
    const ok = await this.deps.repo.consumeEmailVerification(hashToken(token), this.now());
    if (!ok) throw new InvalidTokenError();
  }

  async login(input: {
    email: string;
    password: string;
    portal?: 'participant' | 'business';
    ip: string;
  }): Promise<{
    session: IssuedSession;
    memberships: MembershipSummary[];
    accountType: AccountType;
  }> {
    this.deps.loginLimiter.assertAllowed(input.ip);
    const email = normalizeEmail(input.email);
    const now = this.now();

    const user = await this.deps.repo.findLoginUser(email);
    // Always verify (against a dummy hash for unknown users) so timing does not reveal accounts.
    const passwordOk = await this.deps.hasher.verify(user?.passwordHash ?? null, input.password);
    const locked = !!user && isLocked(user.lockedUntil, now);

    if (!user || !user.passwordHash || !passwordOk || locked) {
      this.deps.loginLimiter.recordFailure(input.ip);
      // A locked account gets the same generic response and no further counter movement.
      if (user && !locked) await this.deps.repo.recordLoginFailure(email, now);
      throw new InvalidCredentialsError();
    }
    // Only businesses must verify their address before signing in; participants may verify later.
    if (!user.emailVerifiedAt && user.accountType === 'BUSINESS') throw new EmailNotVerifiedError();
    // Only after the password is proven, so this never reveals whether an address has an account.
    if (
      user.accountType !==
      ((input.portal ?? 'business') === 'participant' ? 'PARTICIPANT' : 'BUSINESS')
    ) {
      throw new WrongPortalError(user.accountType);
    }

    this.deps.loginLimiter.reset(input.ip);
    const session = this.newSession(now);
    const memberships = await this.deps.repo.startSession(user.id, session.record, now);
    return { session: session.issued, memberships, accountType: user.accountType };
  }

  get googleEnabled(): boolean {
    return !!this.deps.google;
  }

  /** Starts Sign in with Google: the Google URL to send the browser to, and the sealed attempt cookie. */
  beginGoogle(): { redirectUrl: string; attemptCookie: string } {
    const google = this.deps.google;
    if (!google) throw new OAuthFailedError();
    const attempt = newOAuthAttempt(this.now());
    return {
      redirectUrl: google.authorizeUrl({
        state: attempt.state,
        nonce: attempt.nonce,
        codeChallenge: attempt.challenge,
      }),
      attemptCookie: sealAttempt(this.deps.csrfSecret, attempt),
    };
  }

  /**
   * Completes Sign in with Google for participants. Validates the sealed attempt (state, nonce,
   * PKCE verifier), then signs in the participant with that verified email, creating the account on
   * first use. Business accounts are refused: they sign in with email and password.
   */
  async finishGoogle(input: {
    code: string;
    state: string;
    attemptCookie: string | undefined;
    ip: string;
  }): Promise<{ session: IssuedSession; accountType: AccountType }> {
    const google = this.deps.google;
    this.deps.loginLimiter.assertAllowed(input.ip);
    const now = this.now();
    const attempt = openAttempt(this.deps.csrfSecret, input.attemptCookie, now);
    if (!google || !attempt || attempt.state !== input.state) {
      this.deps.loginLimiter.recordFailure(input.ip);
      throw new OAuthFailedError();
    }
    let claims;
    try {
      claims = await google.exchange({
        code: input.code,
        codeVerifier: attempt.verifier,
        nonce: attempt.nonce,
      });
    } catch {
      this.deps.loginLimiter.recordFailure(input.ip);
      throw new OAuthFailedError();
    }
    // Google must vouch for the address, otherwise it proves nothing about who is signing in.
    if (!claims.emailVerified) throw new OAuthFailedError();

    const email = normalizeEmail(claims.email);
    let user = await this.deps.repo.findLoginUser(email);
    if (!user) {
      const created = await this.deps.repo.registerGoogleParticipant({
        userId: uuidv7(now.getTime()),
        email,
        name: claims.name,
      });
      user = await this.deps.repo.findLoginUser(email);
      if (!user || (created === 'exists' && user.accountType !== 'PARTICIPANT')) {
        throw new OAuthFailedError();
      }
    } else if (!user.emailVerifiedAt) {
      await this.deps.repo.adoptVerifiedEmail(user.id, now);
    }
    if (user.accountType !== 'PARTICIPANT') throw new WrongPortalError(user.accountType);

    this.deps.loginLimiter.reset(input.ip);
    const session = this.newSession(now);
    await this.deps.repo.startSession(user.id, session.record, now);
    return { session: session.issued, accountType: user.accountType };
  }

  /** Resolves a cookie token to an authenticated context, or null. Refreshes last-seen. */
  async authenticate(token: string): Promise<AuthContext | null> {
    const tokenHash = hashToken(token);
    const record = await this.deps.repo.findSession(tokenHash);
    const now = this.now();
    if (!record || !isSessionActive(record, now)) return null;
    if (shouldTouch(record.lastSeenAt, now)) {
      await this.deps.repo.touchSession(record.userId, record.sessionId, now);
    }
    return {
      sessionId: record.sessionId,
      userId: record.userId,
      accountType: record.user.accountType,
      email: record.user.email,
      name: record.user.name,
      emailVerified: record.user.emailVerified,
      active: record.active,
      csrfToken: csrfTokenFor(this.deps.csrfSecret, tokenHash),
    };
  }

  async logout(ctx: AuthContext): Promise<void> {
    await this.deps.repo.revokeSession(ctx.userId, ctx.sessionId, this.now());
  }

  async profile(ctx: AuthContext): Promise<{ memberships: MembershipSummary[] }> {
    return { memberships: await this.deps.repo.listMemberships(ctx.userId) };
  }

  /**
   * Switching tenant is a privilege change: the session id/token is rotated and so is the CSRF
   * token (R-IAM-01, R-TEN-12). The absolute expiry of the original session is kept.
   */
  async switchTenant(token: string, membershipId: string): Promise<IssuedSession> {
    const current = await this.deps.repo.findSession(hashToken(token));
    const now = this.now();
    if (!current || !isSessionActive(current, now)) throw new UnauthenticatedError();
    const next = this.newSession(now, current.expiresAt);
    const ok = await this.deps.repo.rotateSession(
      current.userId,
      current,
      next.record,
      membershipId,
      now,
    );
    if (!ok) throw new ForbiddenError('Not a member of that business');
    return next.issued;
  }

  private newSession(now: Date, expiresAt: Date = absoluteExpiry(now)) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    return {
      record: { sessionId: uuidv7(now.getTime()), tokenHash, expiresAt },
      issued: {
        token,
        expiresAt,
        csrfToken: csrfTokenFor(this.deps.csrfSecret, tokenHash),
      } satisfies IssuedSession,
    };
  }
}

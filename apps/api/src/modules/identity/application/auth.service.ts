import {
  EmailNotVerifiedError,
  ForbiddenError,
  InvalidCredentialsError,
  InvalidTokenError,
  UnauthenticatedError,
  WeakPasswordError,
} from '../domain/errors';
import { normalizeEmail } from '../domain/email';
import { isLocked } from '../domain/login-throttle';
import { passwordProblems } from '../domain/password-policy';
import { absoluteExpiry, isSessionActive, shouldTouch } from '../domain/session-policy';
import { csrfTokenFor, generateToken, hashToken } from '../domain/tokens';
import { uuidv7 } from '@/shared/uuid';
import type {
  BreachedPasswordChecker,
  Clock,
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
  loginLimiter: LoginRateLimiter;
  registerLimiter: LoginRateLimiter;
  csrfSecret: string;
  clock?: Clock;
};

export type AuthContext = {
  sessionId: string;
  userId: string;
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
  async register(input: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    agreementVersion: string;
    ip: string;
  }): Promise<void> {
    this.deps.registerLimiter.assertAllowed(input.ip);
    this.deps.registerLimiter.recordFailure(input.ip); // counts every attempt

    const email = normalizeEmail(input.email);
    const problems = passwordProblems(input.password, email);
    if (problems.length === 0 && (await this.deps.breached.isBreached(input.password))) {
      problems.push('has appeared in a known data breach; choose a different password');
    }
    if (problems.length > 0) throw new WeakPasswordError(problems);

    const passwordHash = await this.deps.hasher.hash(input.password);
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

  async verifyEmail(token: string): Promise<void> {
    const ok = await this.deps.repo.consumeEmailVerification(hashToken(token), this.now());
    if (!ok) throw new InvalidTokenError();
  }

  async login(input: { email: string; password: string; ip: string }): Promise<{
    session: IssuedSession;
    memberships: MembershipSummary[];
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
    if (!user.emailVerifiedAt) throw new EmailNotVerifiedError();

    this.deps.loginLimiter.reset(input.ip);
    const session = this.newSession(now);
    const memberships = await this.deps.repo.startSession(user.id, session.record, now);
    return { session: session.issued, memberships };
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

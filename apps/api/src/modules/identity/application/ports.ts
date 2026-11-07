export type Role =
  | 'BUSINESS_OWNER'
  | 'BUSINESS_ADMINISTRATOR'
  | 'CAMPAIGN_MANAGER'
  | 'CAMPAIGN_OPERATOR'
  | 'ANALYST'
  | 'MODERATOR';

export type MembershipSummary = {
  membershipId: string;
  tenantId: string;
  businessName: string;
  role: Role;
};

export type AccountType = 'BUSINESS' | 'PARTICIPANT';

export type ResetOwner = { userId: string; email: string; accountType: AccountType };

export type LoginUser = {
  id: string;
  accountType: AccountType;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  lockedUntil: Date | null;
};

export type SessionRecord = {
  sessionId: string;
  userId: string;
  tokenHash: string;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  user: { email: string; name: string; emailVerified: boolean; accountType: AccountType };
  /** Derived from the session's active membership only (R-TEN-12). */
  active: { membershipId: string; tenantId: string; role: Role } | null;
};

export type NewSession = {
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type RegisterOwnerInput = {
  userId: string;
  tenantId: string;
  membershipId: string;
  email: string;
  name: string;
  passwordHash: string;
  businessName: string;
  /** Version of the agreement (terms + DPA) the owner accepted at registration (R-PRV-01). */
  agreementVersion: string;
  verificationTokenHash: string;
  verificationExpiresAt: Date;
};

export type RegisterParticipantInput = {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  /** Version of the terms the participant accepted (R-PRV-01). */
  agreementVersion: string;
  /** Participants are not required to verify; a token is stored only if one is issued. */
  verificationTokenHash?: string;
  verificationExpiresAt?: Date;
};

export interface IdentityRepository {
  /** Creates a participant user + verification token. No business, no membership. */
  registerParticipant(input: RegisterParticipantInput): Promise<'created' | 'exists'>;
  /** Creates business + user + owner membership + verification token in one transaction. */
  registerOwner(input: RegisterOwnerInput): Promise<'created' | 'exists'>;
  findLoginUser(email: string): Promise<LoginUser | null>;
  /** Creates a participant whose email Google verified: no password, no verification token. */
  registerGoogleParticipant(input: {
    userId: string;
    email: string;
    name: string;
  }): Promise<'created' | 'exists'>;
  /**
   * Google proved ownership of the address. Marks it verified; if it was never verified before,
   * also discards any password set at pre-registration, so someone who registered the address
   * first cannot keep a way into the account.
   */
  adoptVerifiedEmail(userId: string, now: Date): Promise<void>;
  /** Atomically increments the failure counter and applies the progressive lock. */
  recordLoginFailure(email: string, now: Date): Promise<void>;
  /** Resets failure state, creates the session (first membership active) and audits the login. */
  startSession(userId: string, session: NewSession, now: Date): Promise<MembershipSummary[]>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(userId: string, sessionId: string, now: Date): Promise<void>;
  revokeSession(userId: string, sessionId: string, now: Date): Promise<void>;
  /** Revokes `from` and creates `next` active on `membershipId`; false if not a member. */
  rotateSession(
    userId: string,
    from: SessionRecord,
    next: NewSession,
    membershipId: string,
    now: Date,
  ): Promise<boolean>;
  listMemberships(userId: string): Promise<MembershipSummary[]>;
  /** Stores a password-reset token (hash only) for an existing user. */
  createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Who a still-valid reset token belongs to, without consuming it; null if unknown, used or expired. */
  peekPasswordReset(tokenHash: string, now: Date): Promise<ResetOwner | null>;
  /**
   * Single-use: consumes the token, sets the password, marks the address verified (the person
   * proved they own it), clears any lock, revokes every session and any other outstanding
   * reset tokens. Null for the caller that loses a race or presents a bad token.
   */
  completePasswordReset(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<ResetOwner | null>;
  /** Adds a fresh verification token for an existing, unverified user (resend). */
  createEmailVerification(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Single-use: true only for the one call that redeems a valid token. */
  consumeEmailVerification(tokenHash: string, now: Date): Promise<boolean>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Always costs a full verification, even when `hash` is null (timing equalisation). */
  verify(hash: string | null, password: string): Promise<boolean>;
}

export interface BreachedPasswordChecker {
  isBreached(password: string): Promise<boolean>;
}

/** Claims taken from a validated Google ID token. */
export type GoogleClaims = {
  /** Google's stable account id. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export interface GoogleIdentityProvider {
  authorizeUrl(input: { state: string; nonce: string; codeChallenge: string }): string;
  /** Exchanges the code and validates the ID token; throws if anything is wrong. */
  exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleClaims>;
}

export interface Mailer {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
  /** Security notice after a password was reset (no token, no link). */
  sendPasswordChangedEmail(to: string): Promise<void>;
}

export interface LoginRateLimiter {
  /** Throws TooManyRequestsError when the caller is over the limit. */
  assertAllowed(key: string): void;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export type Clock = () => Date;

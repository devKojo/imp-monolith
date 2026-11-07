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

export type LoginUser = {
  id: string;
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
  user: { email: string; name: string; emailVerified: boolean };
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
  verificationTokenHash: string;
  verificationExpiresAt: Date;
};

export interface IdentityRepository {
  /** Creates business + user + owner membership + verification token in one transaction. */
  registerOwner(input: RegisterOwnerInput): Promise<'created' | 'exists'>;
  findLoginUser(email: string): Promise<LoginUser | null>;
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

export interface Mailer {
  sendVerificationEmail(to: string, token: string): Promise<void>;
}

export interface LoginRateLimiter {
  /** Throws TooManyRequestsError when the caller is over the limit. */
  assertAllowed(key: string): void;
  recordFailure(key: string): void;
  reset(key: string): void;
}

export type Clock = () => Date;

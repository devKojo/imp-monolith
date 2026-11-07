import { isLocked, lockedUntil } from '../domain/login-throttle';
import type {
  BreachedPasswordChecker,
  IdentityRepository,
  LoginUser,
  Mailer,
  MembershipSummary,
  NewSession,
  PasswordHasher,
  RegisterOwnerInput,
  SessionRecord,
} from '../application/ports';

type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  failed: number;
  lockedUntil: Date | null;
  membership: MembershipSummary;
};
type SessionRow = SessionRecord;

/** In-memory stand-in for the repository port; real SQL behaviour is covered by the DB tests. */
export class FakeIdentityRepository implements IdentityRepository {
  users = new Map<string, UserRow>(); // by email
  sessions = new Map<string, SessionRow>(); // by tokenHash
  verifications = new Map<string, { userId: string; expiresAt: Date; used: boolean }>();
  touched: string[] = [];

  async registerOwner(i: RegisterOwnerInput) {
    if (this.users.has(i.email)) return 'exists' as const;
    this.users.set(i.email, {
      id: i.userId,
      email: i.email,
      name: i.name,
      passwordHash: i.passwordHash,
      emailVerifiedAt: null,
      failed: 0,
      lockedUntil: null,
      membership: {
        membershipId: i.membershipId,
        tenantId: i.tenantId,
        businessName: i.businessName,
        role: 'BUSINESS_OWNER',
      },
    });
    this.verifications.set(i.verificationTokenHash, {
      userId: i.userId,
      expiresAt: i.verificationExpiresAt,
      used: false,
    });
    return 'created' as const;
  }

  async findLoginUser(email: string): Promise<LoginUser | null> {
    const u = this.users.get(email);
    return u
      ? {
          id: u.id,
          passwordHash: u.passwordHash,
          emailVerifiedAt: u.emailVerifiedAt,
          lockedUntil: u.lockedUntil,
        }
      : null;
  }

  async recordLoginFailure(email: string, now: Date) {
    const u = this.users.get(email);
    if (!u) return;
    u.failed += 1;
    u.lockedUntil = lockedUntil(u.failed, now);
  }

  async startSession(userId: string, s: NewSession, now: Date) {
    const u = [...this.users.values()].find((x) => x.id === userId)!;
    u.failed = 0;
    u.lockedUntil = null;
    this.sessions.set(s.tokenHash, this.record(u, s, now, u.membership));
    return [u.membership];
  }

  private record(u: UserRow, s: NewSession, now: Date, m: MembershipSummary): SessionRow {
    return {
      sessionId: s.sessionId,
      userId: u.id,
      tokenHash: s.tokenHash,
      lastSeenAt: now,
      expiresAt: s.expiresAt,
      revokedAt: null,
      user: { email: u.email, name: u.name, emailVerified: u.emailVerifiedAt !== null },
      active: { membershipId: m.membershipId, tenantId: m.tenantId, role: m.role },
    };
  }

  async findSession(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }
  async touchSession(_userId: string, sessionId: string, now: Date) {
    this.touched.push(sessionId);
    for (const s of this.sessions.values()) if (s.sessionId === sessionId) s.lastSeenAt = now;
  }
  async revokeSession(_userId: string, sessionId: string, now: Date) {
    for (const s of this.sessions.values()) if (s.sessionId === sessionId) s.revokedAt = now;
  }
  async rotateSession(
    userId: string,
    from: SessionRecord,
    next: NewSession,
    membershipId: string,
    now: Date,
  ) {
    const u = [...this.users.values()].find((x) => x.id === userId)!;
    if (u.membership.membershipId !== membershipId) return false;
    this.sessions.get(from.tokenHash)!.revokedAt = now;
    this.sessions.set(next.tokenHash, this.record(u, next, now, u.membership));
    return true;
  }
  async listMemberships(userId: string) {
    return [...this.users.values()].filter((u) => u.id === userId).map((u) => u.membership);
  }
  async consumeEmailVerification(tokenHash: string, now: Date) {
    const v = this.verifications.get(tokenHash);
    if (!v || v.used || v.expiresAt <= now) return false;
    v.used = true;
    const u = [...this.users.values()].find((x) => x.id === v.userId)!;
    u.emailVerifiedAt = now;
    return true;
  }

  isLockedNow(email: string, now: Date) {
    return isLocked(this.users.get(email)?.lockedUntil, now);
  }
}

export class FakeHasher implements PasswordHasher {
  calls = 0;
  async hash(p: string) {
    return `hashed:${p}`;
  }
  async verify(hash: string | null, p: string) {
    this.calls++;
    return hash !== null && hash === `hashed:${p}`;
  }
}

export class FakeBreached implements BreachedPasswordChecker {
  constructor(private readonly bad = new Set<string>()) {}
  async isBreached(p: string) {
    return this.bad.has(p);
  }
}

export class FakeMailer implements Mailer {
  sent: Array<{ to: string; token: string }> = [];
  async sendVerificationEmail(to: string, token: string) {
    this.sent.push({ to, token });
  }
}

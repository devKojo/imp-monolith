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
  RegisterParticipantInput,
  SessionRecord,
} from '../application/ports';

type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  failed: number;
  lockedUntil: Date | null;
  membership: MembershipSummary | null;
  accountType: 'BUSINESS' | 'PARTICIPANT';
};
type SessionRow = SessionRecord;

/** In-memory stand-in for the repository port; real SQL behaviour is covered by the DB tests. */
export class FakeIdentityRepository implements IdentityRepository {
  users = new Map<string, UserRow>(); // by email
  sessions = new Map<string, SessionRow>(); // by tokenHash
  verifications = new Map<string, { userId: string; expiresAt: Date; used: boolean }>();
  touched: string[] = [];

  async registerParticipant(i: RegisterParticipantInput) {
    if (this.users.has(i.email)) return 'exists' as const;
    this.users.set(i.email, {
      id: i.userId,
      email: i.email,
      name: i.name,
      passwordHash: i.passwordHash,
      emailVerifiedAt: null,
      failed: 0,
      lockedUntil: null,
      membership: null,
      accountType: 'PARTICIPANT',
    });
    if (i.verificationTokenHash && i.verificationExpiresAt) {
      this.verifications.set(i.verificationTokenHash, {
        userId: i.userId,
        expiresAt: i.verificationExpiresAt,
        used: false,
      });
    }
    return 'created' as const;
  }

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
      accountType: 'BUSINESS',
    });
    this.verifications.set(i.verificationTokenHash, {
      userId: i.userId,
      expiresAt: i.verificationExpiresAt,
      used: false,
    });
    return 'created' as const;
  }

  async createEmailVerification(userId: string, tokenHash: string, expiresAt: Date) {
    this.verifications.set(tokenHash, { userId, expiresAt, used: false });
  }

  resetTokens = new Map<string, { userId: string; expiresAt: Date; used: boolean }>();

  async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    this.resetTokens.set(tokenHash, { userId, expiresAt, used: false });
  }

  private ownerOf(userId: string) {
    const u = [...this.users.values()].find((x) => x.id === userId)!;
    return { userId: u.id, email: u.email, accountType: u.accountType };
  }

  async peekPasswordReset(tokenHash: string, now: Date) {
    const t = this.resetTokens.get(tokenHash);
    if (!t || t.used || t.expiresAt <= now) return null;
    return this.ownerOf(t.userId);
  }

  async completePasswordReset(i: { tokenHash: string; passwordHash: string; now: Date }) {
    const t = this.resetTokens.get(i.tokenHash);
    if (!t || t.used || t.expiresAt <= i.now) return null;
    t.used = true;
    for (const other of this.resetTokens.values()) if (other.userId === t.userId) other.used = true;
    const u = [...this.users.values()].find((x) => x.id === t.userId)!;
    u.passwordHash = i.passwordHash;
    u.emailVerifiedAt ??= i.now;
    u.failed = 0;
    u.lockedUntil = null;
    for (const s of this.sessions.values()) if (s.userId === u.id) s.revokedAt = i.now;
    return this.ownerOf(u.id);
  }

  async findLoginUser(email: string): Promise<LoginUser | null> {
    const u = this.users.get(email);
    return u
      ? {
          id: u.id,
          accountType: u.accountType,
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
    return u.membership ? [u.membership] : [];
  }

  private record(u: UserRow, s: NewSession, now: Date, m: MembershipSummary | null): SessionRow {
    return {
      sessionId: s.sessionId,
      userId: u.id,
      tokenHash: s.tokenHash,
      lastSeenAt: now,
      expiresAt: s.expiresAt,
      revokedAt: null,
      user: {
        email: u.email,
        name: u.name,
        emailVerified: u.emailVerifiedAt !== null,
        accountType: u.accountType,
      },
      active: m ? { membershipId: m.membershipId, tenantId: m.tenantId, role: m.role } : null,
    };
  }

  async findSession(tokenHash: string) {
    const row = this.sessions.get(tokenHash);
    if (!row) return null;
    // Like the real repository, read the user's current state rather than a login-time snapshot.
    const u = [...this.users.values()].find((x) => x.id === row.userId);
    if (u) row.user.emailVerified = u.emailVerifiedAt !== null;
    return row;
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
    if (u.membership?.membershipId !== membershipId) return false;
    this.sessions.get(from.tokenHash)!.revokedAt = now;
    this.sessions.set(next.tokenHash, this.record(u, next, now, u.membership));
    return true;
  }
  async listMemberships(userId: string) {
    return [...this.users.values()]
      .filter((u) => u.id === userId && u.membership)
      .map((u) => u.membership!);
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
  resets: Array<{ to: string; token: string }> = [];
  changed: string[] = [];
  async sendPasswordResetEmail(to: string, token: string) {
    this.resets.push({ to, token });
  }
  async sendPasswordChangedEmail(to: string) {
    this.changed.push(to);
  }
  async sendVerificationEmail(to: string, token: string) {
    this.sent.push({ to, token });
  }
}

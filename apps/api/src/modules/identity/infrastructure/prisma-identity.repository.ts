import type { PrismaClient } from '@/generated/prisma/client';
import { setIdentityUser, withIdentity, type TenantTx } from '@/shared/database';
import { ConflictError } from '@/shared/errors';
import { TransactionConflictError } from '@/shared/database/errors';
import { uuidv7 } from '@/shared/uuid';
import type {
  IdentityRepository,
  LoginUser,
  MembershipSummary,
  NewSession,
  RegisterOwnerInput,
  RegisterParticipantInput,
  ResetOwner,
  SessionRecord,
} from '../application/ports';
import { UnauthenticatedError } from '../domain/errors';
import { LOCK_THRESHOLD, lockedUntil } from '../domain/login-throttle';

const FAILURE_WINDOW_MS = 15 * 60 * 1000;

type AuditEntry = {
  tenantId: string | null;
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Identifiers and versions only; never PII (R-PRV-06). */
  metadata?: Record<string, string>;
};

/** Audit rows hold identifiers only, never PII (R-SEC-04, R-PRV-06). INSERT-only, so no RETURNING. */
const audit = (tx: TenantTx, e: AuditEntry) =>
  tx.$executeRaw`INSERT INTO audit_log (id, tenant_id, actor_id, action, target_type, target_id, metadata)
    VALUES (${uuidv7()}::uuid, ${e.tenantId}::uuid, ${e.actorId}::uuid, ${e.action},
            ${e.targetType ?? null}, ${e.targetId ?? null}::uuid,
            ${JSON.stringify(e.metadata ?? {})}::jsonb)`;

async function membershipsOf(tx: TenantTx, userId: string): Promise<MembershipSummary[]> {
  const memberships = await tx.membership.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (memberships.length === 0) return [];
  const businesses = await tx.business.findMany({
    where: { id: { in: memberships.map((m) => m.tenantId) } },
  });
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  return memberships.map((m) => ({
    membershipId: m.id,
    tenantId: m.tenantId,
    businessName: names.get(m.tenantId) ?? '',
    role: m.role,
  }));
}

/**
 * A unique violation (the email index is the arbiter, R-DAT-08). TransactionConflictError is also a
 * ConflictError but means a transient write conflict, not a taken address, so it is re-thrown.
 */
function isDuplicate(err: unknown): boolean {
  return err instanceof ConflictError && !(err instanceof TransactionConflictError);
}

/** All access goes through withIdentity so RLS scopes every statement (identity or tenant). */
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: PrismaClient) {}

  async registerParticipant(input: RegisterParticipantInput): Promise<'created' | 'exists'> {
    try {
      await withIdentity(this.db, { userId: input.userId }, async (tx) => {
        await tx.user.create({
          data: {
            id: input.userId,
            email: input.email,
            name: input.name,
            accountType: 'PARTICIPANT',
            passwordHash: input.passwordHash,
          },
        });
        if (input.verificationTokenHash && input.verificationExpiresAt) {
          await tx.emailVerification.create({
            data: {
              userId: input.userId,
              tokenHash: input.verificationTokenHash,
              expiresAt: input.verificationExpiresAt,
            },
          });
        }
        await audit(tx, {
          tenantId: null,
          actorId: input.userId,
          action: 'auth.participant_registered',
          targetType: 'user',
          targetId: input.userId,
          metadata: { agreementVersion: input.agreementVersion },
        });
      });
      return 'created';
    } catch (err) {
      if (isDuplicate(err)) return 'exists';
      throw err;
    }
  }

  async registerGoogleParticipant(input: {
    userId: string;
    email: string;
    name: string;
  }): Promise<'created' | 'exists'> {
    try {
      await withIdentity(this.db, { userId: input.userId }, async (tx) => {
        await tx.user.create({
          data: {
            id: input.userId,
            email: input.email,
            name: input.name,
            accountType: 'PARTICIPANT',
            passwordHash: null,
            emailVerifiedAt: new Date(),
          },
        });
        await audit(tx, {
          tenantId: null,
          actorId: input.userId,
          action: 'auth.participant_registered_google',
          targetType: 'user',
          targetId: input.userId,
        });
      });
      return 'created';
    } catch (err) {
      if (isDuplicate(err)) return 'exists';
      throw err;
    }
  }

  createEmailVerification(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return withIdentity(this.db, { userId }, async (tx) => {
      await tx.emailVerification.create({ data: { userId, tokenHash, expiresAt } });
      await audit(tx, {
        tenantId: null,
        actorId: userId,
        action: 'auth.verification_resent',
        targetType: 'user',
        targetId: userId,
      });
    });
  }

  createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return withIdentity(this.db, { userId }, async (tx) => {
      await tx.passwordReset.create({ data: { userId, tokenHash, expiresAt } });
      await audit(tx, {
        tenantId: null,
        actorId: userId,
        action: 'auth.password_reset_requested',
        targetType: 'user',
        targetId: userId,
      });
    });
  }

  peekPasswordReset(tokenHash: string, now: Date): Promise<ResetOwner | null> {
    return withIdentity(this.db, { resetTokenHash: tokenHash }, async (tx) => {
      const r = await tx.passwordReset.findUnique({ where: { tokenHash } });
      if (!r || r.usedAt || r.expiresAt <= now) return null;
      await setIdentityUser(tx, r.userId);
      const u = await tx.user.findUnique({ where: { id: r.userId } });
      return u ? { userId: u.id, email: u.email, accountType: u.accountType } : null;
    });
  }

  completePasswordReset(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<ResetOwner | null> {
    const { tokenHash, passwordHash, now } = input;
    return withIdentity(this.db, { resetTokenHash: tokenHash }, async (tx) => {
      const r = await tx.passwordReset.findUnique({ where: { tokenHash } });
      if (!r) return null;
      await setIdentityUser(tx, r.userId);
      // The conditional update is the single-use guard: only one concurrent redeemer matches.
      const { count } = await tx.passwordReset.updateMany({
        where: { id: r.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count !== 1) return null;
      const user = await tx.user.findUniqueOrThrow({ where: { id: r.userId } });
      await tx.user.update({
        where: { id: r.userId },
        data: {
          passwordHash,
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          failedLoginCount: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        },
      });
      await tx.session.updateMany({
        where: { userId: r.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.passwordReset.updateMany({
        where: { userId: r.userId, usedAt: null },
        data: { usedAt: now },
      });
      await audit(tx, {
        tenantId: null,
        actorId: r.userId,
        action: 'auth.password_reset_completed',
        targetType: 'user',
        targetId: r.userId,
      });
      return { userId: user.id, email: user.email, accountType: user.accountType };
    });
  }

  adoptVerifiedEmail(userId: string, now: Date): Promise<void> {
    return withIdentity(this.db, { userId }, async (tx) => {
      // Only ever called for an account whose email was never verified, so any password on it
      // was set by whoever pre-registered the address and is discarded.
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: now, passwordHash: null },
      });
      await audit(tx, {
        tenantId: null,
        actorId: userId,
        action: 'auth.email_verified_via_google',
        targetType: 'user',
        targetId: userId,
      });
    });
  }

  async registerOwner(input: RegisterOwnerInput): Promise<'created' | 'exists'> {
    try {
      await withIdentity(
        this.db,
        { userId: input.userId, tenantId: input.tenantId },
        async (tx) => {
          await tx.business.create({ data: { id: input.tenantId, name: input.businessName } });
          await tx.user.create({
            data: {
              id: input.userId,
              email: input.email,
              name: input.name,
              passwordHash: input.passwordHash,
            },
          });
          await tx.membership.create({
            data: {
              id: input.membershipId,
              tenantId: input.tenantId,
              userId: input.userId,
              role: 'BUSINESS_OWNER',
            },
          });
          await tx.emailVerification.create({
            data: {
              userId: input.userId,
              tokenHash: input.verificationTokenHash,
              expiresAt: input.verificationExpiresAt,
            },
          });
          await audit(tx, {
            tenantId: input.tenantId,
            actorId: input.userId,
            action: 'auth.registered',
            targetType: 'user',
            targetId: input.userId,
            metadata: { agreementVersion: input.agreementVersion },
          });
        },
      );
      return 'created';
    } catch (err) {
      // The email unique index is the arbiter (R-DAT-08): the whole transaction rolled back.
      if (isDuplicate(err)) return 'exists';
      throw err;
    }
  }

  findLoginUser(email: string): Promise<LoginUser | null> {
    return withIdentity(this.db, { loginEmail: email }, async (tx) => {
      const u = await tx.user.findUnique({ where: { email } });
      return u
        ? {
            id: u.id,
            accountType: u.accountType,
            passwordHash: u.passwordHash,
            emailVerifiedAt: u.emailVerifiedAt,
            lockedUntil: u.lockedUntil,
          }
        : null;
    });
  }

  recordLoginFailure(email: string, now: Date): Promise<void> {
    const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MS);
    return withIdentity(this.db, { loginEmail: email }, async (tx) => {
      // Atomic increment (no read-modify-write). The count restarts after a quiet 15-minute
      // window unless the account has already reached the lock threshold (progressive delay).
      const rows = await tx.$queryRaw<{ id: string; failed_login_count: number }[]>`
        UPDATE users SET
          failed_login_count = CASE
            WHEN failed_login_count < ${LOCK_THRESHOLD}
                 AND (last_failed_login_at IS NULL OR last_failed_login_at < ${windowStart})
            THEN 1 ELSE failed_login_count + 1 END,
          last_failed_login_at = ${now}
        WHERE email = ${email}
        RETURNING id, failed_login_count`;
      const row = rows[0];
      if (!row) return;
      const until = lockedUntil(row.failed_login_count, now);
      if (until)
        await tx.$executeRaw`UPDATE users SET locked_until = ${until} WHERE id = ${row.id}::uuid`;
      await setIdentityUser(tx, row.id);
      await audit(tx, {
        tenantId: null,
        actorId: row.id,
        action: until ? 'auth.account_locked' : 'auth.login_failed',
        targetType: 'user',
        targetId: row.id,
      });
    });
  }

  startSession(userId: string, session: NewSession, now: Date): Promise<MembershipSummary[]> {
    return withIdentity(this.db, { userId }, async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { failedLoginCount: 0, lockedUntil: null, lastFailedLoginAt: null },
      });
      const memberships = await membershipsOf(tx, userId);
      const first = memberships[0];
      await tx.session.create({
        data: {
          id: session.sessionId,
          tokenHash: session.tokenHash,
          userId,
          activeTenantId: first?.tenantId ?? null,
          activeMembershipId: first?.membershipId ?? null,
          createdAt: now,
          lastSeenAt: now,
          expiresAt: session.expiresAt,
        },
      });
      await audit(tx, {
        tenantId: null,
        actorId: userId,
        action: 'auth.login_succeeded',
        targetType: 'session',
        targetId: session.sessionId,
      });
      return memberships;
    });
  }

  findSession(tokenHash: string): Promise<SessionRecord | null> {
    return withIdentity(this.db, { sessionTokenHash: tokenHash }, async (tx) => {
      const s = await tx.session.findUnique({ where: { tokenHash } });
      if (!s) return null;
      // The session identifies its owner; narrow the scope to read the user and membership.
      await setIdentityUser(tx, s.userId);
      const user = await tx.user.findUnique({ where: { id: s.userId } });
      if (!user) return null;
      const m = s.activeMembershipId
        ? await tx.membership.findFirst({
            where: { id: s.activeMembershipId, userId: s.userId, deletedAt: null },
          })
        : null;
      return {
        sessionId: s.id,
        userId: s.userId,
        tokenHash: s.tokenHash,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        user: {
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerifiedAt !== null,
          accountType: user.accountType,
        },
        active: m ? { membershipId: m.id, tenantId: m.tenantId, role: m.role } : null,
      };
    });
  }

  async touchSession(userId: string, sessionId: string, now: Date): Promise<void> {
    await withIdentity(this.db, { userId }, (tx) =>
      tx.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { lastSeenAt: now },
      }),
    );
  }

  async revokeSession(userId: string, sessionId: string, now: Date): Promise<void> {
    await withIdentity(this.db, { userId }, async (tx) => {
      const { count } = await tx.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
      if (count > 0) {
        await audit(tx, {
          tenantId: null,
          actorId: userId,
          action: 'auth.logout',
          targetType: 'session',
          targetId: sessionId,
        });
      }
    });
  }

  rotateSession(
    userId: string,
    from: SessionRecord,
    next: NewSession,
    membershipId: string,
    now: Date,
  ): Promise<boolean> {
    return withIdentity(this.db, { userId }, async (tx) => {
      const m = await tx.membership.findFirst({
        where: { id: membershipId, userId, deletedAt: null },
      });
      if (!m) return false;
      const { count } = await tx.session.updateMany({
        where: { id: from.sessionId, userId, revokedAt: null },
        data: { revokedAt: now },
      });
      if (count !== 1) throw new UnauthenticatedError(); // lost a concurrent rotation/logout
      await tx.session.create({
        data: {
          id: next.sessionId,
          tokenHash: next.tokenHash,
          userId,
          activeTenantId: m.tenantId,
          activeMembershipId: m.id,
          createdAt: now,
          lastSeenAt: now,
          expiresAt: next.expiresAt, // rotation never extends the absolute lifetime
        },
      });
      await audit(tx, {
        tenantId: null,
        actorId: userId,
        action: 'auth.tenant_switched',
        targetType: 'membership',
        targetId: m.id,
      });
      return true;
    });
  }

  listMemberships(userId: string): Promise<MembershipSummary[]> {
    return withIdentity(this.db, { userId }, (tx) => membershipsOf(tx, userId));
  }

  consumeEmailVerification(tokenHash: string, now: Date): Promise<boolean> {
    return withIdentity(this.db, { verificationTokenHash: tokenHash }, async (tx) => {
      const v = await tx.emailVerification.findUnique({ where: { tokenHash } });
      if (!v) return false;
      await setIdentityUser(tx, v.userId);
      // Conditional update is the single-use guard: only one concurrent redeemer matches.
      const { count } = await tx.emailVerification.updateMany({
        where: { id: v.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (count !== 1) return false;
      await tx.user.update({ where: { id: v.userId }, data: { emailVerifiedAt: now } });
      await audit(tx, {
        tenantId: null,
        actorId: v.userId,
        action: 'auth.email_verified',
        targetType: 'user',
        targetId: v.userId,
      });
      return true;
    });
  }
}

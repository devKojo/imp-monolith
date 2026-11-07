/**
 * Identity against real PostgreSQL with the real roles and RLS. Skipped unless the same
 * TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as the isolation suite are set.
 */
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createPlatformDb,
  createTenantDb,
  createTenantContext,
  withTenant,
} from '@/shared/database';
import { uuidv7 } from '@/shared/uuid';
import { AuthService } from '../application/auth.service';
import { hashToken } from '../domain/tokens';
import { Argon2Hasher } from '../infrastructure/argon2-hasher';
import { MemoryRateLimiter } from '../infrastructure/memory-rate-limiter';
import { PrismaIdentityRepository } from '../infrastructure/prisma-identity.repository';
import { FakeBreached, FakeMailer } from './fakes';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;

describe.skipIf(!(runtimeUrl && platformUrl))('identity repository (real PostgreSQL, RLS)', () => {
  const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 8 });
  const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
  const repo = new PrismaIdentityRepository(db);
  const mailer = new FakeMailer();
  const auth = new AuthService({
    repo,
    hasher: new Argon2Hasher(2),
    breached: new FakeBreached(),
    mailer,
    loginLimiter: new MemoryRateLimiter(1000, 60_000),
    registerLimiter: new MemoryRateLimiter(1000, 60_000),
    csrfSecret: 's'.repeat(32),
  });

  const tag = randomUUID().slice(0, 8);
  const emails: string[] = [];
  const email = (n: string) => {
    const e = `${n}-${tag}@test.local`;
    emails.push(e);
    return e;
  };
  const PASSWORD = 'correct horse battery staple';

  async function registerVerified(name: string) {
    const e = email(name);
    const before = mailer.sent.length;
    await auth.register({
      name,
      email: e,
      password: PASSWORD,
      businessName: `${name} Co`,
      agreementVersion: '1.0',
      ip: '1.1.1.1',
    });
    expect(mailer.sent).toHaveLength(before + 1);
    await auth.verifyEmail(mailer.sent[before]!.token);
    return e;
  }

  afterAll(async () => {
    const users = await platform.user.findMany({ where: { email: { in: emails } } });
    const ids = users.map((u) => u.id);
    const memberships = await platform.membership.findMany({ where: { userId: { in: ids } } });
    await platform.session.deleteMany({ where: { userId: { in: ids } } });
    await platform.emailVerification.deleteMany({ where: { userId: { in: ids } } });
    await platform.membership.deleteMany({ where: { userId: { in: ids } } });
    await platform.user.deleteMany({ where: { id: { in: ids } } });
    await platform.business.deleteMany({
      where: { id: { in: memberships.map((m) => m.tenantId) } },
    });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  it('registers business, owner, membership and verification atomically, with an audit row', async () => {
    const e = await registerVerified('reg');
    const user = await platform.user.findUniqueOrThrow({ where: { email: e } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.emailVerifiedAt).not.toBeNull();
    const m = await platform.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect(m.role).toBe('BUSINESS_OWNER');
    const audits = await platform.$queryRaw<{ action: string }[]>`
      SELECT action FROM audit_log WHERE actor_id = ${user.id}::uuid ORDER BY created_at`;
    expect(audits.map((a) => a.action)).toEqual(['auth.registered', 'auth.email_verified']);
    // The accepted agreement version is recorded at registration (R-PRV-01).
    const [registered] = await platform.$queryRaw<{ metadata: { agreementVersion: string } }[]>`
      SELECT metadata FROM audit_log WHERE actor_id = ${user.id}::uuid AND action = 'auth.registered'`;
    expect(registered?.metadata).toEqual({ agreementVersion: '1.0' });
  });

  it('registers a participant with no business or membership, and signs in on its own portal', async () => {
    const e = email('part');
    const before = mailer.sent.length;
    await auth.registerParticipant({
      name: 'Part',
      email: e,
      password: PASSWORD,
      agreementVersion: '1.0',
      ip: '1.1.1.1',
    });
    await auth.verifyEmail(mailer.sent[before]!.token);

    const user = await platform.user.findUniqueOrThrow({ where: { email: e } });
    expect(user.accountType).toBe('PARTICIPANT');
    expect(await platform.membership.count({ where: { userId: user.id } })).toBe(0);
    const [audit] = await platform.$queryRaw<
      { tenant_id: string | null; metadata: { agreementVersion: string } }[]
    >`SELECT tenant_id, metadata FROM audit_log
      WHERE actor_id = ${user.id}::uuid AND action = 'auth.participant_registered'`;
    expect(audit?.tenant_id).toBeNull();
    expect(audit?.metadata).toEqual({ agreementVersion: '1.0' });

    await expect(
      auth.login({ email: e, password: PASSWORD, portal: 'business', ip: '1.1.1.1' }),
    ).rejects.toMatchObject({ code: 'WRONG_PORTAL' });
    const ok = await auth.login({
      email: e,
      password: PASSWORD,
      portal: 'participant',
      ip: '1.1.1.1',
    });
    expect(ok.accountType).toBe('PARTICIPANT');
    expect(ok.memberships).toEqual([]);

    const ctx = await auth.authenticate(ok.session.token);
    expect(ctx).toMatchObject({ accountType: 'PARTICIPANT', active: null });
  });

  it('a business owner cannot use the participant portal', async () => {
    const e = await registerVerified('wrongportal');
    await expect(
      auth.login({ email: e, password: PASSWORD, portal: 'participant', ip: '1.1.1.1' }),
    ).rejects.toMatchObject({ code: 'WRONG_PORTAL' });
  });

  it('a duplicate email rolls everything back and reports exists', async () => {
    const e = await registerVerified('dup');
    const result = await repo.registerOwner({
      userId: uuidv7(),
      tenantId: uuidv7(),
      membershipId: uuidv7(),
      email: e,
      name: 'x',
      passwordHash: 'h',
      businessName: `Ghost Co ${tag}`,
      agreementVersion: '1.0',
      verificationTokenHash: hashToken(randomUUID()),
      verificationExpiresAt: new Date(Date.now() + 1000),
    });
    expect(result).toBe('exists');
    expect(await platform.business.count({ where: { name: `Ghost Co ${tag}` } })).toBe(0);
  });

  it('rejects emails that are not normalised (database constraint)', async () => {
    await expect(
      platform.user.create({ data: { email: `UPPER-${tag}@test.local`, name: 'x' } }),
    ).rejects.toThrow();
  });

  it('identity data is invisible without a scope, and to tenant scope', async () => {
    const e = await registerVerified('scope');
    const user = await platform.user.findUniqueOrThrow({ where: { email: e } });
    const m = await platform.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect(await db.user.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
    const { session } = await auth.login({ email: e, password: PASSWORD, ip: '1.1.1.1' });
    const seenViaTenant = await withTenant(
      db,
      createTenantContext({ tenantId: m.tenantId, requestId: 'r' }),
      (tx) => tx.session.count(),
    );
    expect(seenViaTenant).toBe(0);
    expect(session.token).toBeTruthy();
  });

  it('login -> authenticate -> logout lifecycle, storing only token hashes', async () => {
    const e = await registerVerified('life');
    const { session, memberships } = await auth.login({
      email: e,
      password: PASSWORD,
      ip: '2.2.2.2',
    });
    expect(memberships).toHaveLength(1);
    const rows = await platform.session.findMany({ where: { user: { email: e } } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(session.token));
    expect(JSON.stringify(rows)).not.toContain(session.token);

    const ctx = await auth.authenticate(session.token);
    expect(ctx?.active?.role).toBe('BUSINESS_OWNER');
    expect(ctx?.active?.tenantId).toBe(memberships[0]!.tenantId);
    expect(await auth.authenticate('not-a-token')).toBeNull();

    await auth.logout(ctx!);
    expect(await auth.authenticate(session.token)).toBeNull();
  });

  it("a user cannot revoke or rotate another user's session", async () => {
    const a = await registerVerified('own-a');
    const b = await registerVerified('own-b');
    const sa = await auth.login({ email: a, password: PASSWORD, ip: '3.3.3.3' });
    const sb = await auth.login({ email: b, password: PASSWORD, ip: '3.3.3.3' });
    const ctxA = (await auth.authenticate(sa.session.token))!;
    const ctxB = (await auth.authenticate(sb.session.token))!;
    await repo.revokeSession(ctxB.userId, ctxA.sessionId, new Date()); // B targets A's session
    expect(await auth.authenticate(sa.session.token)).not.toBeNull();
    await expect(
      auth.switchTenant(sa.session.token, sb.memberships[0]!.membershipId),
    ).rejects.toThrow(/member/);
  });

  it('switching tenant rotates the session and keeps the absolute expiry', async () => {
    const e = await registerVerified('rot');
    const { session, memberships } = await auth.login({
      email: e,
      password: PASSWORD,
      ip: '4.4.4.4',
    });
    const next = await auth.switchTenant(session.token, memberships[0]!.membershipId);
    expect(next.token).not.toBe(session.token);
    expect(next.csrfToken).not.toBe(session.csrfToken);
    expect(next.expiresAt).toEqual(session.expiresAt);
    expect(await auth.authenticate(session.token)).toBeNull();
    expect(await auth.authenticate(next.token)).not.toBeNull();
  });

  it('email verification is redeemable exactly once under concurrency', async () => {
    const e = email('race');
    await auth.register({
      name: 'r',
      email: e,
      password: PASSWORD,
      businessName: 'Race Co',
      agreementVersion: '1.0',
      ip: '5.5.5.5',
    });
    const token = mailer.sent.at(-1)!.token;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => repo.consumeEmailVerification(hashToken(token), new Date())),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('concurrent failures are counted atomically and lock the account', async () => {
    const e = await registerVerified('fail');
    const now = new Date();
    await Promise.all(Array.from({ length: 8 }, () => repo.recordLoginFailure(e, now)));
    const u = await platform.user.findUniqueOrThrow({ where: { email: e } });
    expect(u.failedLoginCount).toBe(8);
    expect(u.lockedUntil!.getTime()).toBeGreaterThan(now.getTime());
    // locked: the right password is refused with the generic error
    await expect(auth.login({ email: e, password: PASSWORD, ip: '6.6.6.6' })).rejects.toMatchObject(
      {
        code: 'INVALID_CREDENTIALS',
      },
    );
  });

  it('a successful login clears the failure counter', async () => {
    const e = await registerVerified('reset');
    const now = new Date();
    await Promise.all(Array.from({ length: 3 }, () => repo.recordLoginFailure(e, now)));
    await auth.login({ email: e, password: PASSWORD, ip: '7.7.7.7' });
    const u = await platform.user.findUniqueOrThrow({ where: { email: e } });
    expect(u.failedLoginCount).toBe(0);
    expect(u.lockedUntil).toBeNull();
  });
});

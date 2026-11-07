/**
 * Database-level isolation tests (R-TEN-13, ARC-004). They need a migrated database with the real
 * roles, so they are skipped unless these are set (never point them at production data):
 *   TEST_DATABASE_URL_RUNTIME   app_runtime connection
 *   TEST_DATABASE_URL_SYSTEM    app_system connection
 *   TEST_DATABASE_URL_PLATFORM  app_platform connection (seeds and cleans up rows)
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import { createPlatformDb, createSystemDb, createTenantDb } from './clients';
import { createTenantContext } from './tenant-context';
import { withTenant } from './with-tenant';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const systemUrl = process.env.TEST_DATABASE_URL_SYSTEM;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && systemUrl && platformUrl);

describe.skipIf(!enabled)('RLS isolation (real PostgreSQL, real roles)', () => {
  const tenantDb = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 5 });
  const systemDb = createSystemDb({ connectionString: systemUrl ?? '', poolMax: 2 });
  const platformDb = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });

  const ctx = (tenantId: string) => createTenantContext({ tenantId, requestId: randomUUID() });
  let a: string;
  let b: string;
  let userA: string;
  let userB: string;
  const runTag = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const [ba, bb] = await Promise.all([
      platformDb.business.create({ data: { name: `A-${runTag}` } }),
      platformDb.business.create({ data: { name: `B-${runTag}` } }),
    ]);
    a = ba.id;
    b = bb.id;
    const [ua, ub] = await Promise.all([
      platformDb.user.create({ data: { email: `a-${runTag}@test.local`, name: 'A' } }),
      platformDb.user.create({ data: { email: `b-${runTag}@test.local`, name: 'B' } }),
    ]);
    userA = ua.id;
    userB = ub.id;
    await platformDb.membership.createMany({
      data: [
        { tenantId: a, userId: userA, role: 'BUSINESS_OWNER' },
        { tenantId: b, userId: userB, role: 'BUSINESS_OWNER' },
      ],
    });
  });

  afterAll(async () => {
    await platformDb.membership.deleteMany({ where: { tenantId: { in: [a, b] } } });
    await platformDb.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await platformDb.business.deleteMany({ where: { id: { in: [a, b] } } });
    await Promise.all([tenantDb.$disconnect(), systemDb.$disconnect(), platformDb.$disconnect()]);
  });

  it('returns zero rows when no tenant is set (fails closed)', async () => {
    expect(await tenantDb.business.count()).toBe(0);
    expect(await tenantDb.membership.count()).toBe(0);
  });

  it('shows a tenant only its own rows, and only its own users', async () => {
    const seen = await withTenant(tenantDb, ctx(a), async (tx) => ({
      businesses: await tx.business.findMany(),
      memberships: await tx.membership.findMany(),
      users: await tx.user.findMany(),
    }));
    expect(seen.businesses.map((r) => r.id)).toEqual([a]);
    expect(seen.memberships.map((r) => r.tenantId)).toEqual([a]);
    expect(seen.users.map((r) => r.id)).toEqual([userA]);
  });

  it('blocks tenant B from reading, updating or deleting tenant A rows', async () => {
    const result = await withTenant(tenantDb, ctx(b), async (tx) => ({
      read: await tx.membership.findMany({ where: { tenantId: a } }),
      updated: await tx.membership.updateMany({
        where: { tenantId: a },
        data: { role: 'ANALYST' },
      }),
      deleted: await tx.membership.deleteMany({ where: { tenantId: a } }),
    }));
    expect(result.read).toEqual([]);
    expect(result.updated.count).toBe(0);
    expect(result.deleted.count).toBe(0);
    const still = await platformDb.membership.findFirst({ where: { tenantId: a } });
    expect(still?.role).toBe('BUSINESS_OWNER');
  });

  it('blocks tenant B from inserting rows for tenant A (WITH CHECK)', async () => {
    await expect(
      withTenant(tenantDb, ctx(b), (tx) =>
        tx.membership.createMany({ data: [{ tenantId: a, userId: userB, role: 'ANALYST' }] }),
      ),
    ).rejects.toThrow();
  });

  it('does not leak between concurrent tenants on pooled connections', async () => {
    const jobs = Array.from({ length: 60 }, (_, i) => {
      const tenant = i % 2 === 0 ? a : b;
      return withTenant(tenantDb, ctx(tenant), async (tx) => {
        const rows = await tx.membership.findMany();
        return rows.every((r) => r.tenantId === tenant) && rows.length === 1;
      });
    });
    expect((await Promise.all(jobs)).every(Boolean)).toBe(true);
  });

  it('lets the runtime role insert but never read outbox rows; the system role reads all', async () => {
    const eventId = randomUUID();
    const aggregateId = randomUUID();
    await withTenant(
      tenantDb,
      ctx(a),
      (tx) =>
        tx.$executeRaw`INSERT INTO outbox_events (id, tenant_id, partition, aggregate_type, aggregate_id, aggregate_version, event_type, envelope)
                     VALUES (${eventId}::uuid, ${a}::uuid, 0, 'Test', ${aggregateId}::uuid, 1, 'test.created.v1', '{}'::jsonb)`,
    );
    await expect(
      withTenant(tenantDb, ctx(a), (tx) => tx.$queryRaw`SELECT id FROM outbox_events`),
    ).rejects.toThrow();
    const rows = await systemDb.$queryRaw<
      { id: string }[]
    >`SELECT id FROM outbox_events WHERE id = ${eventId}::uuid`;
    expect(rows).toHaveLength(1);
    await systemDb.$executeRaw`DELETE FROM outbox_events WHERE id = ${eventId}::uuid`;
  });

  it('keeps audit_log append-only for the runtime role', async () => {
    const id = randomUUID();
    await withTenant(
      tenantDb,
      ctx(a),
      (tx) =>
        tx.$executeRaw`INSERT INTO audit_log (id, tenant_id, action) VALUES (${id}::uuid, ${a}::uuid, 'test')`,
    );
    await expect(
      withTenant(
        tenantDb,
        ctx(a),
        (tx) => tx.$executeRaw`UPDATE audit_log SET action = 'x' WHERE id = ${id}::uuid`,
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(
        tenantDb,
        ctx(a),
        (tx) => tx.$executeRaw`DELETE FROM audit_log WHERE id = ${id}::uuid`,
      ),
    ).rejects.toThrow();
  });
});

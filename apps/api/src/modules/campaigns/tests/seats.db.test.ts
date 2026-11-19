/**
 * Participant seats against real PostgreSQL: the last seat closes the campaign, and people racing for it
 * cannot take more seats than exist. Skipped unless the same TEST_DATABASE_URL_* variables as the other
 * database suites are set.
 */
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPlatformDb,
  createTenantContext,
  createTenantDb,
  withTenant,
} from '@/shared/database';
import { CampaignFullError } from '../domain/errors';
import { claimSeat } from '../infrastructure/participant-seats';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 12 });
const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
const tag = randomUUID().slice(0, 8);

describe.skipIf(!enabled)('participant seats at the database level', () => {
  let tenantId = '';
  const ctx = () => createTenantContext({ tenantId, requestId: randomUUID() });
  const make = async (settings: object) =>
    (
      await withTenant(db, ctx(), (tx) =>
        tx.campaign.create({
          data: {
            tenantId,
            title: 'Pool',
            createdById: randomUUID(),
            status: 'LIVE',
            // A launched campaign has its address and an end (a database check).
            slug: `pool-${randomUUID()}`,
            endAt: new Date(Date.now() + 86_400_000),
            settings,
          },
        }),
      )
    ).id;
  const claim = (campaignId: string) =>
    withTenant(db, ctx(), (tx) => claimSeat(tx, tenantId, campaignId));
  const read = (id: string) =>
    withTenant(db, ctx(), (tx) => tx.campaign.findFirstOrThrow({ where: { id } }));
  const pool = (maxParticipants: number) => ({
    pool: { kind: 'POINTS', amount: 1000, currency: null, maxParticipants },
  });

  beforeAll(async () => {
    tenantId = (await platform.business.create({ data: { name: `Seats-${tag}` } })).id;
  });

  afterAll(async () => {
    await platform.campaign.deleteMany({ where: { tenantId } });
    await platform.business.deleteMany({ where: { id: tenantId } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  it('takes seats until the pool is full, and the last one closes the campaign', async () => {
    const id = await make(pool(2));
    const before = await read(id);
    await claim(id);
    expect(await read(id)).toMatchObject({ participantCount: 1, status: 'LIVE' });
    await claim(id);
    const full = await read(id);
    expect(full).toMatchObject({ participantCount: 2, status: 'COMPLETED' });
    expect(full.version).toBe(before.version + 1);
    await expect(claim(id)).rejects.toBeInstanceOf(CampaignFullError);
    expect((await read(id)).participantCount).toBe(2);
  });

  it('never gives out more seats than exist when many people join at once', async () => {
    const id = await make(pool(5));
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => claim(id)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const refused = results.filter((r) => r.status === 'rejected');
    expect(refused).toHaveLength(7);
    for (const r of refused) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(CampaignFullError);
    }
    expect(await read(id)).toMatchObject({ participantCount: 5, status: 'COMPLETED' });
  });

  it('counts people on a campaign without a pool and never closes it', async () => {
    const id = await make({});
    for (let i = 0; i < 3; i += 1) await claim(id);
    expect(await read(id)).toMatchObject({ participantCount: 3, status: 'LIVE' });
  });

  it('does not touch another business', async () => {
    const other = (await platform.business.create({ data: { name: `SeatsB-${tag}` } })).id;
    try {
      const id = await make(pool(3));
      await expect(
        withTenant(db, createTenantContext({ tenantId: other, requestId: randomUUID() }), (tx) =>
          claimSeat(tx, other, id),
        ),
      ).rejects.toBeInstanceOf(CampaignFullError);
      expect((await read(id)).participantCount).toBe(0);
    } finally {
      await platform.business.deleteMany({ where: { id: other } });
    }
  });
});

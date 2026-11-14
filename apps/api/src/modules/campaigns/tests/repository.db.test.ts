/**
 * The repository contract against real PostgreSQL with the real roles and RLS, plus the
 * database-level guarantees (isolation, composite foreign key, address uniqueness, constraints).
 * Skipped unless the same TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as the isolation suite are set.
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
import { PrismaCampaignRepository } from '../infrastructure/prisma-campaign.repository';
import { PrismaCampaignUsage } from '../infrastructure/prisma-campaign-usage';
import { repositoryContract, type ContractWorld } from './repository.contract';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
const tag = randomUUID().slice(0, 8);
const tenants: string[] = [];
let userId = '';

async function business(name: string) {
  const b = await platform.business.create({ data: { name: `${name}-${tag}` } });
  tenants.push(b.id);
  return b.id;
}
const template = (tenantId: string) =>
  platform.template.create({
    data: { tenantId, name: 'T', archetype: 'GIVEAWAY', createdById: userId },
  });

if (enabled) {
  repositoryContract('PostgreSQL', async (): Promise<ContractWorld> => {
    const [a, b] = await Promise.all([business('CmpA'), business('CmpB')]);
    const user = await platform.user.create({
      data: { email: `cmp-${tag}@test.local`, name: 'C' },
    });
    userId = user.id;
    const t = await template(a);
    return {
      repo: new PrismaCampaignRepository(db),
      tenantA: a,
      tenantB: b,
      userA: user.id,
      templateA: t.id,
    };
  });
}

describe.skipIf(!enabled)('campaigns at the database level', () => {
  let tenantA = '';
  let tenantB = '';
  let templateA = '';
  let campaignId = '';
  const ctx = (tenantId: string) => createTenantContext({ tenantId, requestId: randomUUID() });
  const row = (over: Record<string, unknown> = {}) => ({
    tenantId: tenantA,
    title: 'Secret',
    createdById: randomUUID(),
    ...over,
  });

  beforeAll(async () => {
    tenantA = await business('RlsA');
    tenantB = await business('RlsB');
    templateA = (await template(tenantA)).id;
    const c = await withTenant(db, ctx(tenantA), (tx) => tx.campaign.create({ data: row() }));
    campaignId = c.id;
    await withTenant(db, ctx(tenantA), (tx) =>
      tx.campaignPrize.create({
        data: { tenantId: tenantA, campaignId, position: 0, name: 'Prize', winners: 1 },
      }),
    );
  });

  afterAll(async () => {
    await platform.campaignPrize.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.campaign.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.templateField.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.template.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.business.deleteMany({ where: { id: { in: tenants } } });
    if (userId) await platform.user.deleteMany({ where: { id: userId } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  it('shows nothing when no tenant is set (fails closed)', async () => {
    expect(await db.campaign.count()).toBe(0);
    expect(await db.campaignPrize.count()).toBe(0);
  });

  it('hides a campaign and its prizes from another business, even by id', async () => {
    const seen = await withTenant(db, ctx(tenantB), async (tx) => ({
      campaigns: await tx.campaign.findMany(),
      byId: await tx.campaign.findFirst({ where: { id: campaignId } }),
      prizes: await tx.campaignPrize.findMany({ where: { campaignId } }),
    }));
    expect(seen.campaigns).toEqual([]);
    expect(seen.byId).toBeNull();
    expect(seen.prizes).toEqual([]);
  });

  it('blocks writing rows into another business, and hijacking one', async () => {
    await expect(
      withTenant(db, ctx(tenantB), (tx) => tx.campaign.create({ data: row({ title: 'Planted' }) })),
    ).rejects.toThrow();
    const changed = await withTenant(db, ctx(tenantB), (tx) =>
      tx.campaign.updateMany({ where: { id: campaignId }, data: { title: 'Hijacked' } }),
    );
    expect(changed.count).toBe(0);
  });

  it('does not let the runtime role hard-delete a campaign', async () => {
    await expect(
      withTenant(db, ctx(tenantA), (tx) => tx.campaign.deleteMany({ where: { id: campaignId } })),
    ).rejects.toThrow();
  });

  it('only lets a campaign use a template of its own business (composite foreign key)', async () => {
    await expect(
      platform.campaign.create({ data: row({ tenantId: tenantB, templateId: templateA }) }),
    ).rejects.toThrow();
    await expect(
      platform.campaignPrize.create({
        data: { tenantId: tenantB, campaignId, position: 0, name: 'x', winners: 1 },
      }),
    ).rejects.toThrow();
  });

  it('enforces the constraints the application also checks', async () => {
    const bad = (data: Record<string, unknown>) =>
      withTenant(db, ctx(tenantA), (tx) => tx.campaign.create({ data: row(data) as never }));
    await expect(bad({ title: '' })).rejects.toThrow();
    await expect(
      bad({ startAt: new Date('2027-02-01'), endAt: new Date('2027-01-01') }),
    ).rejects.toThrow();
    await expect(bad({ slug: 'Not A Slug' })).rejects.toThrow();
    await expect(bad({ status: 'LIVE' })).rejects.toThrow(); // launched needs an address and an end
    await expect(
      withTenant(db, ctx(tenantA), (tx) =>
        tx.campaignPrize.create({
          data: { tenantId: tenantA, campaignId, position: 1, name: 'x', winners: 0 },
        }),
      ),
    ).rejects.toThrow();
  });

  it('answers whether a template is in use by a running campaign that has not ended', async () => {
    const usage = new PrismaCampaignUsage(db);
    expect(await usage.isInUse(ctx(tenantA), templateA)).toBe(false);
    const make = (data: Record<string, unknown>) =>
      platform.campaign.create({ data: row({ templateId: templateA, ...data }) as never });
    const future = new Date(Date.now() + 86_400_000);

    const draft = await make({ title: 'draft' });
    expect(await usage.isInUse(ctx(tenantA), templateA)).toBe(false);
    const ended = await make({
      title: 'ended',
      status: 'LIVE',
      slug: `e-${tag}`,
      endAt: new Date(Date.now() - 1000),
    });
    expect(await usage.isInUse(ctx(tenantA), templateA)).toBe(false);
    const live = await make({ title: 'live', status: 'LIVE', slug: `l-${tag}`, endAt: future });
    expect(await usage.isInUse(ctx(tenantA), templateA)).toBe(true);
    expect(await usage.isInUse(ctx(tenantB), templateA)).toBe(false);
    await platform.campaign.updateMany({
      where: { id: { in: [ended.id, live.id] } },
      data: { status: 'CANCELLED' },
    });
    expect(draft.status).toBe('DRAFT');
    expect(await usage.isInUse(ctx(tenantA), templateA)).toBe(false);
  });
});

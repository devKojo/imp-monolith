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
import {
  SEEDED,
  giveawayTemplate,
  pollTemplate,
  quizTemplate,
  surveyTemplate,
  voteTemplate,
} from './fixtures';
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

if (enabled) {
  repositoryContract('PostgreSQL', async (): Promise<ContractWorld> => {
    const [a, b] = await Promise.all([business('CmpA'), business('CmpB')]);
    const user = await platform.user.create({
      data: { email: `cmp-${tag}@test.local`, name: 'C' },
    });
    userId = user.id;
    return {
      repo: new PrismaCampaignRepository(db),
      tenantA: a,
      tenantB: b,
      userA: user.id,
      templateA: SEEDED.giveaway,
    };
  });
}

describe.skipIf(!enabled)('campaigns at the database level', () => {
  let tenantA = '';
  let tenantB = '';
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
    const c = await withTenant(db, ctx(tenantA), (tx) => tx.campaign.create({ data: row() }));
    campaignId = c.id;
    await withTenant(db, ctx(tenantA), (tx) =>
      tx.campaignPrize.create({
        data: { tenantId: tenantA, campaignId, position: 0, name: 'Prize', winners: 1 },
      }),
    );
  });

  afterAll(async () => {
    await platform.campaignField.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.campaignPrize.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.campaign.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.business.deleteMany({ where: { id: { in: tenants } } });
    if (userId) await platform.user.deleteMany({ where: { id: userId } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  describe('returning a campaign to draft', () => {
    const launchedCampaign = async () => {
      const c = await withTenant(db, ctx(tenantA), (tx) =>
        tx.campaign.create({
          data: row({
            title: 'Was live',
            status: 'LIVE',
            slug: `was-live-${randomUUID().slice(0, 8)}`,
            endAt: new Date(Date.now() + 86_400_000),
          }),
        }),
      );
      return c;
    };
    const repo = () => new PrismaCampaignRepository(db);

    it('is refused once someone has joined (seat counted), and nothing changes', async () => {
      const c = await launchedCampaign();
      await platform.campaign.update({ where: { id: c.id }, data: { participantCount: 1 } });
      const result = await repo().returnToDraft(ctx(tenantA), c.id, c.version);
      expect(result.kind).toBe('has_participants');
      const after = await platform.campaign.findUniqueOrThrow({ where: { id: c.id } });
      expect(after.status).toBe('LIVE');
      expect(after.slug).toBe(c.slug);
    });

    it('is refused when a response exists even if the seat count was never bumped', async () => {
      const c = await launchedCampaign();
      const person = await platform.user.create({
        data: { email: `resp-${randomUUID().slice(0, 8)}@test.local`, name: 'R' },
      });
      await platform.surveyResponse.create({
        data: { tenantId: tenantA, campaignId: c.id, userId: person.id },
      });
      const result = await repo().returnToDraft(ctx(tenantA), c.id, c.version);
      expect(result.kind).toBe('has_participants');
      await platform.surveyResponse.deleteMany({ where: { campaignId: c.id } });
      await platform.user.delete({ where: { id: person.id } });
    });

    it('works when nobody has taken part, and clears the address', async () => {
      const c = await launchedCampaign();
      const result = await repo().returnToDraft(ctx(tenantA), c.id, c.version);
      expect(result.kind === 'ok' && result.campaign).toMatchObject({
        status: 'DRAFT',
        slug: null,
      });
    });
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

  it('only lets a campaign use a built-in type that exists, and children stay in their business', async () => {
    await expect(
      platform.campaign.create({ data: row({ templateId: randomUUID() }) }),
    ).rejects.toThrow();
    await expect(
      platform.campaign.create({ data: row({ templateId: SEEDED.quiz }) }),
    ).resolves.toBeTruthy();
    await expect(
      platform.campaignPrize.create({
        data: { tenantId: tenantB, campaignId, position: 0, name: 'x', winners: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      platform.campaignField.create({
        data: {
          tenantId: tenantB,
          campaignId,
          position: 0,
          kind: 'EMAIL',
          key: 'email',
          label: 'x',
        },
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

  it('hides campaign fields from another business and from an unscoped query', async () => {
    await withTenant(db, ctx(tenantA), (tx) =>
      tx.campaignField.create({
        data: {
          tenantId: tenantA,
          campaignId,
          position: 0,
          kind: 'EMAIL',
          key: 'email',
          label: 'Email',
        },
      }),
    );
    expect(await db.campaignField.count()).toBe(0);
    const seen = await withTenant(db, ctx(tenantB), (tx) => tx.campaignField.findMany());
    expect(seen).toEqual([]);
    const planted = withTenant(db, ctx(tenantB), (tx) =>
      tx.campaignField.create({
        data: {
          tenantId: tenantA,
          campaignId,
          position: 1,
          kind: 'PHONE',
          key: 'phone',
          label: 'P',
        },
      }),
    );
    await expect(planted).rejects.toThrow();
  });

  it('enforces the field rules in the database too', async () => {
    const make = (data: Record<string, unknown>) =>
      withTenant(db, ctx(tenantA), (tx) =>
        tx.campaignField.create({
          data: {
            tenantId: tenantA,
            campaignId,
            position: 5,
            kind: 'QUIZ_QUESTION',
            key: `k_${randomUUID().slice(0, 6)}`,
            label: 'Q',
            options: ['A', 'B'],
            ...data,
          } as never,
        }),
      );
    await expect(make({ correctIndex: 1 })).resolves.toBeTruthy();
    await expect(make({ correctIndex: 2 })).rejects.toThrow(); // past the options
    await expect(make({ correctIndex: -1 })).rejects.toThrow();
    await expect(make({ kind: 'CHOICE', correctIndex: 0 })).rejects.toThrow(); // only a quiz question
    await expect(make({ key: 'Not Snake' })).rejects.toThrow();
    await expect(
      make({ options: Array.from({ length: 21 }, (_, i) => String(i)) }),
    ).rejects.toThrow();
    await expect(make({ key: 'email' })).rejects.toThrow(); // already used in this campaign
  });

  it('seeds the six built-in types exactly as the test fixtures say, and keeps them read-only', async () => {
    const found = await db.campaignTemplate.findMany({
      orderBy: { position: 'asc' },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    const shape = (t: {
      slug: string;
      minContentFields: number;
      requiresPrizes: boolean;
      fields: Array<{
        kind: string;
        maxCount: number | null;
        defaultCount: number;
        defaultRequired: boolean;
      }>;
    }) => ({
      slug: t.slug,
      min: t.minContentFields,
      prizes: t.requiresPrizes,
      fields: t.fields.map((f) => [
        f.kind.toLowerCase(),
        f.maxCount,
        f.defaultCount,
        f.defaultRequired,
      ]),
    });
    const fixture = (t: typeof quizTemplate) => ({
      slug: t.slug,
      min: t.minContentFields,
      prizes: t.requiresPrizes,
      fields: t.fields.map((f) => [f.kind, f.maxCount, f.defaultCount, f.defaultRequired]),
    });
    const bySlug = Object.fromEntries(found.map((t) => [t.slug, shape(t)]));
    expect(bySlug.quiz).toEqual(fixture(quizTemplate));
    expect(bySlug.survey).toEqual(fixture(surveyTemplate));
    expect(bySlug.giveaway).toEqual(fixture(giveawayTemplate));
    expect(bySlug.poll).toEqual(fixture(pollTemplate));
    expect(bySlug.vote).toEqual(fixture(voteTemplate));
    expect(Object.keys(bySlug).sort()).toEqual([
      'giveaway',
      'poll',
      'quiz',
      'survey',
      'vote',
    ]);

    await expect(
      db.campaignTemplate.create({
        data: { slug: 'mine', name: 'Mine', archetype: 'QUIZ' },
      }),
    ).rejects.toThrow();
    await expect(db.campaignTemplate.updateMany({ data: { name: 'Hijacked' } })).rejects.toThrow();
  });
});

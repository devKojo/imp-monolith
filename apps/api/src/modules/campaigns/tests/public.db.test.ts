/**
 * The public listing against real PostgreSQL with the real roles and RLS: exactly which campaigns
 * a visitor can see, what they cannot, and that opening the public scope does not weaken anything
 * for businesses. Skipped unless the same TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as the
 * isolation suite are set.
 */
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPlatformDb,
  createTenantContext,
  createTenantDb,
  withPublic,
  withTenant,
} from '@/shared/database';
import { SEEDED } from './fixtures';
import { PublicDiscoveryService } from '../application/public-discovery.service';
import { PrismaPublicCampaignRepository } from '../infrastructure/prisma-public-campaigns.repository';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const HOUR = 3_600_000;

describe.skipIf(!enabled)('public discovery (real PostgreSQL, real roles)', () => {
  const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
  const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
  const service = new PublicDiscoveryService(new PrismaPublicCampaignRepository(db));
  const tag = randomUUID().slice(0, 8);
  const at = (hours: number) => new Date(Date.now() + hours * HOUR);

  let a = '';
  let b = '';
  let suspended = '';
  let giveawayA = '';
  let quizA = '';
  let quizB = '';
  const businesses: string[] = [];
  const ids: Record<string, string> = {};

  async function business(name: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
    const row = await platform.business.create({ data: { name: `${name} ${tag}`, status } });
    businesses.push(row.id);
    return row.id;
  }
  /** The built-in type for a kind of campaign: global, so the business does not matter. */
  const template = async (
    _tenantId: string,
    archetype: 'GIVEAWAY' | 'QUIZ' | 'SURVEY' | 'INSTANT',
  ) => SEEDED[archetype.toLowerCase() as keyof typeof SEEDED];

  async function campaign(
    key: string,
    tenantId: string,
    templateId: string,
    over: Record<string, unknown> = {},
    prizes: Array<{ name: string; valueLabel?: string }> = [],
  ) {
    const c = await platform.campaign.create({
      data: {
        tenantId,
        templateId,
        title: `${key} ${tag}`,
        summary: `About ${key}`,
        slug: `${key}-${tag}`,
        status: 'LIVE',
        endAt: at(48),
        createdById: randomUUID(),
        ...over,
      } as never,
    });
    ids[key] = c.id;
    for (const [position, p] of prizes.entries()) {
      await platform.campaignPrize.create({
        data: {
          tenantId,
          campaignId: c.id,
          position,
          name: p.name,
          valueLabel: p.valueLabel ?? '',
          winners: 1,
        },
      });
    }
    return c.id;
  }

  const visible = async (q?: string, type?: 'quiz' | 'giveaway' | 'survey' | 'poll' | 'vote') => {
    const res = await service.list({ ...(q ? { q } : {}), ...(type ? { type } : {}) });
    return res.items.filter((i) => i.slug.endsWith(tag));
  };

  beforeAll(async () => {
    a = await business('Alpha Ltd');
    b = await business('Beta Ltd', 'PENDING');
    suspended = await business('Gamma Ltd', 'SUSPENDED');
    giveawayA = await template(a, 'GIVEAWAY');
    quizA = await template(a, 'QUIZ');
    quizB = await template(b, 'QUIZ');
    const instantA = await template(a, 'INSTANT');
    const surveyA = await template(a, 'SURVEY');
    const tGamma = await template(suspended, 'GIVEAWAY');

    // Visible
    await campaign('live-a', a, giveawayA, { endAt: at(10) }, [
      { name: 'Grand prize', valueLabel: 'GH₵ 5,000' },
      { name: 'Second' },
    ]);
    await campaign('live-b', b, quizB, { endAt: at(20) }); // a PENDING business still shows
    await campaign('started', a, quizA, { status: 'SCHEDULED', startAt: at(-1), endAt: at(30) });
    await campaign('instant', a, instantA, { endAt: at(40) }, [{ name: 'Scratch card' }]);
    await campaign('survey', a, surveyA, { endAt: at(50) });
    // Hidden
    await campaign('draft', a, quizA, { status: 'DRAFT', slug: null, endAt: null });
    await campaign('paused', a, quizA, { status: 'PAUSED' });
    await campaign('cancelled', a, quizA, { status: 'CANCELLED' });
    await campaign('completed', a, quizA, { status: 'COMPLETED' });
    await campaign('not-started', a, quizA, { status: 'SCHEDULED', startAt: at(5) });
    await campaign('ended', a, quizA, { endAt: at(-1) });
    await campaign('deleted', a, quizA, { deletedAt: new Date() });
    await campaign('suspended', suspended, tGamma);
  });

  afterAll(async () => {
    await platform.campaignPrize.deleteMany({ where: { tenantId: { in: businesses } } });
    await platform.campaign.deleteMany({ where: { tenantId: { in: businesses } } });
    await platform.business.deleteMany({ where: { id: { in: businesses } } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  it('lists exactly the running campaigns, of every business, soonest to close first', async () => {
    const items = await visible();
    expect(items.map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'live-a',
      'live-b',
      'started',
      'instant',
      'survey',
    ]);
  });

  it('hides drafts, paused, cancelled, completed, not yet started, ended, deleted and suspended', async () => {
    const slugs = (await visible()).map((i) => i.slug.replace(`-${tag}`, ''));
    for (const hidden of [
      'draft',
      'paused',
      'cancelled',
      'completed',
      'not-started',
      'ended',
      'deleted',
      'suspended',
    ]) {
      expect(slugs).not.toContain(hidden);
    }
  });

  it('shows public content only', async () => {
    const live = (await visible()).find((i) => i.slug.startsWith('live-a'))!;
    expect(Object.keys(live).sort()).toEqual([
      'businessName',
      'endsAt',
      'id',
      'prize',
      'slug',
      'summary',
      'timeZone',
      'title',
      'type',
    ]);
    expect(live).toMatchObject({
      title: `live-a ${tag}`,
      summary: 'About live-a',
      businessName: `Alpha Ltd ${tag}`,
      type: 'giveaway',
      timeZone: 'UTC',
      prize: { label: 'Grand prize', value: 'GH₵ 5,000' },
    });
    const noPrize = (await visible()).find((i) => i.slug.startsWith('survey'))!;
    expect(noPrize).not.toHaveProperty('prize');
  });

  it('treats an instant win as a giveaway, and filters by type', async () => {
    const giveaways = (await visible(undefined, 'giveaway')).map((i) =>
      i.slug.replace(`-${tag}`, ''),
    );
    expect(giveaways).toEqual(['live-a', 'instant']);
    expect((await visible(undefined, 'quiz')).map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'live-b',
      'started',
    ]);
    expect((await visible(undefined, 'survey')).map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'survey',
    ]);
    expect(await visible(undefined, 'poll')).toEqual([]);
    expect(await visible(undefined, 'vote')).toEqual([]);
  });

  it('searches titles, text, business names and prizes, ignoring case', async () => {
    expect((await visible(`LIVE-A ${tag}`)).map((i) => i.slug)).toEqual([`live-a-${tag}`]);
    expect((await visible(`about survey`)).map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'survey',
    ]);
    expect((await visible(`beta ltd ${tag}`)).map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'live-b',
    ]);
    expect((await visible('gh₵ 5,000')).map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'live-a',
    ]);
    expect((await visible('scratch card')).map((i) => i.slug.replace(`-${tag}`, ''))).toEqual([
      'instant',
    ]);
    expect(await visible('no such thing xyz')).toEqual([]);
  });

  it('does not search hidden campaigns', async () => {
    expect(await visible(`paused ${tag}`)).toEqual([]);
    expect(await visible(`draft ${tag}`)).toEqual([]);
  });

  it('pages with an opaque cursor, without gaps or repeats', async () => {
    // Walk the listing in pages of one by using the repository directly.
    const repo = new PrismaPublicCampaignRepository(db);
    const seen: string[] = [];
    let after: { endAt: Date; id: string } | undefined;
    for (let guard = 0; guard < 200; guard++) {
      const rows = await repo.find({ limit: 1, now: new Date(), ...(after ? { after } : {}) });
      if (rows.length === 0) break;
      seen.push(rows[0]!.slug);
      after = { endAt: rows[0]!.endAt, id: rows[0]!.id };
    }
    const mine = seen.filter((s) => s.endsWith(tag)).map((s) => s.replace(`-${tag}`, ''));
    expect(mine).toEqual(['live-a', 'live-b', 'started', 'instant', 'survey']);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('reaches nothing else through the public scope', async () => {
    const seen = await withPublic(db, async (tx) => ({
      drafts: await tx.campaign.count({ where: { status: 'DRAFT', tenantId: { in: businesses } } }),
      paused: await tx.campaign.count({
        where: { status: 'PAUSED', tenantId: { in: businesses } },
      }),
      fields: await tx.campaignField.count(),
      memberships: await tx.membership.count(),
      users: await tx.user.count(),
      sessions: await tx.session.count(),
      audit: await tx.auditLog.count(),
      suspendedBusiness: await tx.business.count({ where: { id: suspended } }),
      prizesOfHidden: await tx.campaignPrize.count({ where: { campaignId: ids.paused } }),
    }));
    expect(seen).toEqual({
      drafts: 0,
      paused: 0,
      fields: 0,
      memberships: 0,
      users: 0,
      sessions: 0,
      audit: 0,
      suspendedBusiness: 0,
      prizesOfHidden: 0,
    });
  });

  it('cannot write through the public scope', async () => {
    await expect(
      withPublic(db, (tx) => tx.campaign.updateMany({ data: { title: 'Hijacked' } })),
    ).resolves.toMatchObject({ count: 0 });
    await expect(
      withPublic(db, (tx) =>
        tx.campaign.create({ data: { tenantId: a, title: 'x', createdById: randomUUID() } }),
      ),
    ).rejects.toThrow();
  });

  it('leaves a business exactly as isolated as before', async () => {
    const asB = createTenantContext({ tenantId: b, requestId: randomUUID() });
    const seen = await withTenant(db, asB, (tx) =>
      tx.campaign.findMany({ where: { tenantId: { in: businesses } } }),
    );
    expect(seen.every((c) => c.tenantId === b)).toBe(true);
    expect(seen.map((c) => c.slug)).toEqual([`live-b-${tag}`]);
    // And with no scope at all, nothing is visible.
    expect(await db.campaign.count()).toBe(0);
  });
});

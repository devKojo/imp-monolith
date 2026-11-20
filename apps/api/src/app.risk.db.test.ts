/**
 * End to end for the reward risk controls (ADR-R001, R5): the real app, the real identity guards (session cookie,
 * CSRF, Origin, password step-up), the real routes and real PostgreSQL with the real roles and RLS. Sessions
 * are created directly in the test database. Skipped unless the same TEST_DATABASE_URL_RUNTIME / _PLATFORM
 * variables as the isolation suite are set.
 */
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { config } from 'dotenv';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { InMemoryEventBus } from './infrastructure/messaging/in-memory-event-bus';
import { createCampaignsModule } from './modules/campaigns';
import { SEEDED } from './modules/campaigns/tests/fixtures';
import { createGiveawayModule } from './modules/giveaway';
import { createIdentityModule } from './modules/identity';
import { csrfTokenFor, generateToken, hashToken } from './modules/identity/domain/tokens';
import { createRewardsModule, type RewardsModule } from './modules/rewards';
import { PgRateLimiter } from './modules/rewards/infrastructure/pg-rate-limiter';
import { createTemplatesModule } from './modules/templates';
import {
  createPlatformDb,
  createTenantContext,
  createTenantDb,
  withTenant,
} from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);
const PASSWORD = 'Plum-Quartz-Harbor-7391!';

describe.skipIf(!enabled)(
  'reward risk controls end to end (real guards, real PostgreSQL)',
  () => {
    const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 8 });
    const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
    const tag = randomUUID().slice(0, 8);

    type Person = { cookie: string; csrf: string; userId: string };
    let tenantA = '';
    const people = {} as Record<'owner' | 'ama' | 'kofi' | 'yaw', Person>;
    const userIds: string[] = [];
    let app: Awaited<ReturnType<typeof createApp>>;
    let rewards: RewardsModule;

    async function session(userId: string, active?: { tenantId: string; membershipId: string }) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      await platform.session.create({
        data: {
          tokenHash,
          userId,
          activeTenantId: active?.tenantId ?? null,
          activeMembershipId: active?.membershipId ?? null,
          expiresAt: new Date(Date.now() + 8 * 3600_000),
        },
      });
      return { cookie: `__Host-sid=${token}`, csrf: csrfTokenFor(SECRET, tokenHash) };
    }

    async function owner(): Promise<Person> {
      const user = await platform.user.create({
        data: { email: `rowner-${tag}@test.local`, name: 'rowner', emailVerifiedAt: new Date() },
      });
      userIds.push(user.id);
      const membership = await platform.membership.create({
        data: { tenantId: tenantA, userId: user.id, role: 'BUSINESS_OWNER' },
      });
      return {
        ...(await session(user.id, { tenantId: tenantA, membershipId: membership.id })),
        userId: user.id,
      };
    }

    async function participant(name: string, verified: boolean): Promise<Person> {
      const user = await platform.user.create({
        data: {
          email: `${name}-${tag}@test.local`,
          name,
          accountType: 'PARTICIPANT',
          // Established accounts, so the new-account rule does not colour what each test is about.
          createdAt: new Date(Date.now() - 30 * 86_400_000),
          passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
          emailVerifiedAt: verified ? new Date() : null,
        },
      });
      userIds.push(user.id);
      return { ...(await session(user.id)), userId: user.id };
    }

    beforeAll(async () => {
      tenantA = (await platform.business.create({ data: { name: `E2E-RK-${tag}` } })).id;
      people.owner = await owner();
      people.ama = await participant('rama', true);
      people.kofi = await participant('rkofi', true);
      people.yaw = await participant('ryaw', false);

      const identity = createIdentityModule({
        db,
        allowedOrigins: [ORIGIN],
        sessionSecret: SECRET,
      });
      const templates = createTemplatesModule({ db, identity });
      rewards = createRewardsModule({ db, identity, dataKey: 'a-test-data-key-for-risk' });
      app = await createApp({
        bus: new InMemoryEventBus(),
        identity,
        templates,
        campaigns: createCampaignsModule({ db, identity, templates: templates.lookup }),
        giveaway: createGiveawayModule({ db, identity }),
        rewards,
      });
    });

    afterAll(async () => {
      const where = { tenantId: tenantA };
      await platform.scamReport.deleteMany({ where });
      await platform.rateLimitCounter.deleteMany({
        where: { OR: userIds.map((u) => ({ key: { endsWith: u } })) },
      });
      await platform.pointsLedger.deleteMany({ where });
      await platform.rewardClaim.deleteMany({ where });
      await platform.rewardEvent.deleteMany({ where });
      await platform.rewardAward.deleteMany({ where });
      await platform.rewardDraw.deleteMany({ where });
      await platform.participationSignal.deleteMany({ where });
      await platform.giveawayEntry.deleteMany({ where });
      await platform.campaignPrize.deleteMany({ where });
      await platform.campaign.deleteMany({ where });
      await platform.session.deleteMany({ where: { userId: { in: userIds } } });
      await platform.membership.deleteMany({ where });
      await platform.user.deleteMany({ where: { id: { in: userIds } } });
      await platform.business.deleteMany({ where: { id: tenantA } });
      await Promise.all([db.$disconnect(), platform.$disconnect()]);
    });

    const read = (p: Person, path: string) =>
      request(app).get(`/api/v1/${path}`).set('Cookie', p.cookie);
    const post = (p: Person, path: string, body: object = {}) =>
      request(app)
        .post(`/api/v1/${path}`)
        .set('Cookie', p.cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', p.csrf)
        .send(body);

    const details = [
      {
        kind: 'email',
        label: 'Email',
        helper: '',
        required: true,
        options: [],
        correctIndex: null,
      },
      {
        kind: 'consent',
        label: 'I agree',
        helper: '',
        required: true,
        options: [],
        correctIndex: null,
      },
    ];

    /** A launched giveaway, entered by ama, kofi and yaw, closed and settled so that every one of them wins. */
    async function settled(
      title: string,
      prize: { kind: 'CASH' | 'POINTS' | 'ITEM'; amountMinor: number | null },
      /** Shapes the join signals before settling. By default they are cleared, so nothing is flagged. */
      tune?: (campaignId: string) => Promise<void>,
    ) {
      const created = await post(people.owner, 'campaigns', { title, templateId: SEEDED.giveaway });
      expect(created.status).toBe(201);
      const saved = await request(app)
        .put(`/api/v1/campaigns/${created.body.id}`)
        .set('Cookie', people.owner.cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', people.owner.csrf)
        .send({
          expectedVersion: created.body.version,
          title,
          summary: 'Win',
          templateId: SEEDED.giveaway,
          startAt: null,
          endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          prizes: [{ name: 'Grand prize', valueLabel: '', winners: 3, description: '' }],
          fields: details,
          settings: { quiz: null },
        });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const launch = await post(people.owner, `campaigns/${created.body.id}/launch`, {
        expectedVersion: saved.body.version,
      });
      expect(launch.status).toBe(200);
      const id = created.body.id as string;
      await platform.campaignPrize.updateMany({
        where: { campaignId: id },
        data: {
          kind: prize.kind,
          amountMinor: prize.amountMinor,
          currency: prize.kind === 'CASH' ? 'GHS' : null,
        },
      });
      for (const p of [people.ama, people.kofi, people.yaw]) {
        expect((await post(p, `giveaway/${launch.body.slug}/entry`)).status).toBe(200);
      }
      // Every test request comes from one address and one browser, which the risk rules rightly notice.
      // These tests are about the mechanics, so they start from no signals; app.risk.db.test.ts covers the rules.
      if (tune) await tune(id);
      else await platform.participationSignal.deleteMany({ where: { tenantId: tenantA } });
      expect((await post(people.owner, `rewards/campaigns/${id}/draw/seal`)).status).toBe(200);
      await platform.rewardDraw.updateMany({
        where: { campaignId: id },
        data: { sealedAt: new Date(Date.now() - 3_600_000) },
      });
      await platform.campaign.update({
        where: { id },
        data: { endAt: new Date(Date.now() - 60_000) },
      });
      const made = await post(people.owner, `rewards/campaigns/${id}/award`);
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      return { id };
    }

    /** The award a person won in a campaign. */
    async function awardOf(p: Person, campaignId: string) {
      const list = await read(p, 'my-rewards');
      expect(list.status, JSON.stringify(list.body)).toBe(200);
      const found = list.body.items.find(
        (a: { campaign: { id: string } }) => a.campaign.id === campaignId,
      );
      expect(found).toBeTruthy();
      return found as { id: string; status: string; claimHint: string | null };
    }

    const mobile = {
      method: 'MOBILE_MONEY',
      destination: '+233 24 123 4567',
      accountName: 'Ama Mensah',
      password: PASSWORD,
    };

    const code = (r: { body: { code?: string; error?: { code?: string } } }) =>
      r.body.error?.code ?? r.body.code;
    const businessView = async (campaignId: string) =>
      (await read(people.owner, `rewards/campaigns/${campaignId}/awards`)).body.items as Array<{
        id: string;
        name: string;
        status: string;
        riskScore: number;
        riskReasons: string[];
      }>;
    const review = (awardId: string, body: object) =>
      post(people.owner, `rewards/awards/${awardId}/review`, body);

    /** Everyone joined from one address and one browser, as every test request does. */
    const sameNetwork = async (campaignId: string) => {
      expect(await platform.participationSignal.count({ where: { campaignId } })).toBe(3);
      await platform.participationSignal.updateMany({
        where: { campaignId },
        data: { ipHash: 'ip-crowd', uaHash: 'ua-crowd' },
      });
    };
    /** ama and kofi share a network (different browsers); yaw is alone. */
    const partlyShared = async (campaignId: string) => {
      const set = (userId: string, ipHash: string, uaHash: string) =>
        platform.participationSignal.updateMany({
          where: { campaignId, userId },
          data: { ipHash, uaHash },
        });
      await set(people.ama.userId, 'ip-shared', 'ua-a');
      await set(people.kofi.userId, 'ip-shared', 'ua-b');
      await set(people.yaw.userId, 'ip-alone', 'ua-c');
    };

    describe('at claim', () => {
      it('holds a payout destination another person already used, until it is reviewed', async () => {
        const c = await settled('Destination reuse', { kind: 'CASH', amountMinor: 5000 });
        const shared = { ...mobile, destination: '+233 20 555 0003' };
        const ama = await awardOf(people.ama, c.id);
        const kofi = await awardOf(people.kofi, c.id);

        const first = await post(people.ama, `my-rewards/${ama.id}/claim`, shared);
        expect(first.body.status).toBe('CLAIMED');
        const second = await post(people.kofi, `my-rewards/${kofi.id}/claim`, {
          ...shared,
          accountName: 'Kofi Mensah',
        });
        expect(second.status, JSON.stringify(second.body)).toBe(200);
        expect(second.body.status).toBe('HELD');
        // Claiming again is not an error and changes nothing.
        const again = await post(people.kofi, `my-rewards/${kofi.id}/claim`, shared);
        expect(again.body).toMatchObject({ status: 'HELD', alreadyClaimed: true });
        expect(await platform.rewardClaim.count({ where: { awardId: kofi.id } })).toBe(1);

        // The winner sees held and a generic reason; the business sees why.
        const detail = JSON.stringify((await read(people.kofi, `my-rewards/${kofi.id}`)).body);
        expect(detail).toContain('REVIEW_REQUIRED');
        expect(detail).not.toContain('DESTINATION_REUSE');
        const row = (await businessView(c.id)).find((a) => a.id === kofi.id);
        expect(row).toMatchObject({ status: 'HELD' });
        expect(row?.riskReasons).toContain('DESTINATION_REUSE');

        // It cannot be paid while held; releasing it makes it payable again.
        const pay = `rewards/awards/${kofi.id}/fulfil`;
        const early = await post(people.owner, pay, { reference: 'MOMO-77' });
        expect(early.status).toBe(409);
        expect(code(early)).toBe('AWARD_NOT_PAYABLE');
        const released = await review(kofi.id, { decision: 'release' });
        expect(released.body.status).toBe('CLAIMED');
        expect((await post(people.owner, pay, { reference: 'MOMO-77' })).status).toBe(200);
        const types = (await platform.rewardEvent.findMany({ where: { awardId: kofi.id } })).map(
          (e) => e.type,
        );
        expect(types.sort()).toEqual(['awarded', 'claimed', 'fulfilled', 'held', 'released']);
      });
    });

    describe('at settlement', () => {
      it('lets a medium risk be released by the business, and starts the claim clock then', async () => {
        const c = await settled('Risk medium', { kind: 'CASH', amountMinor: 5000 }, partlyShared);
        const items = await businessView(c.id);
        const byName = Object.fromEntries(items.map((a) => [a.name, a]));
        expect(byName.rama?.status).toBe('PENDING_REVIEW');
        expect(byName.rama?.riskScore).toBeLessThan(70);
        expect(byName.rama?.riskScore).toBeGreaterThanOrEqual(30);
        expect(byName.ryaw?.status).toBe('AVAILABLE');

        const ama = await awardOf(people.ama, c.id);
        const waiting = await platform.rewardAward.findUniqueOrThrow({ where: { id: ama.id } });
        expect(waiting.claimBy).toBeNull();

        const released = await review(ama.id, { decision: 'release' });
        expect(released.status, JSON.stringify(released.body)).toBe(200);
        expect(released.body.status).toBe('AVAILABLE');
        const open = await platform.rewardAward.findUniqueOrThrow({ where: { id: ama.id } });
        expect(open.claimBy && open.claimBy.getTime() > Date.now() + 13 * 86_400_000).toBe(true);

        const own = { ...mobile, destination: '+233 20 555 0002' };
        const claimed = await post(people.ama, `my-rewards/${ama.id}/claim`, own);
        expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
        expect(claimed.body.status).toBe('CLAIMED');

        const kofi = await awardOf(people.kofi, c.id);
        expect((await review(kofi.id, { decision: 'reject', reason: 'NOT_ELIGIBLE' })).status).toBe(
          200,
        );
        // Reviewing is for business roles; a participant cannot, and an unknown award is not found.
        expect(
          (await post(people.ama, `rewards/awards/${kofi.id}/review`, { decision: 'release' }))
            .status,
        ).toBe(403);
        expect((await review(randomUUID(), { decision: 'release' })).status).toBe(404);
      });

      it('holds winners who all joined from one network and browser, and flags them for the platform', async () => {
        const c = await settled('Risk flagged', { kind: 'CASH', amountMinor: 5000 }, sameNetwork);
        const items = await businessView(c.id);
        expect(items).toHaveLength(3);
        for (const a of items) {
          expect(a.status).toBe('PENDING_REVIEW');
          expect(a.riskScore).toBeGreaterThanOrEqual(70);
          expect(a.riskReasons).toEqual(
            expect.arrayContaining(['SHARED_NETWORK', 'SHARED_DEVICE', 'WINNERS_SAME_NETWORK']),
          );
        }

        // The winner sees a held award and a generic reason, never which rule fired.
        const mine = await awardOf(people.ama, c.id);
        expect(mine.status).toBe('PENDING_REVIEW');
        const detail = await read(people.ama, `my-rewards/${mine.id}`);
        const seen = JSON.stringify(detail.body);
        expect(seen).toContain('REVIEW_REQUIRED');
        for (const leak of [
          'SHARED_NETWORK',
          'SHARED_DEVICE',
          'WINNERS_SAME_NETWORK',
          'riskScore',
        ]) {
          expect(seen).not.toContain(leak);
        }
        // Nothing can be claimed while it waits.
        const claim = await post(people.ama, `my-rewards/${mine.id}/claim`, mobile);
        expect(claim.status).toBe(409);
        expect(code(claim)).toBe('AWARD_NOT_CLAIMABLE');

        // A business cannot release a flagged award; it can reject one, with a reason.
        const release = await review(mine.id, { decision: 'release' });
        expect(release.status).toBe(403);
        expect(code(release)).toBe('PLATFORM_REVIEW_REQUIRED');
        expect((await review(mine.id, { decision: 'reject' })).status).toBe(400);
        const rejected = await review(mine.id, { decision: 'reject', reason: 'SUSPECTED_ABUSE' });
        expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
        expect(rejected.body.status).toBe('REJECTED');
        const events = await platform.rewardEvent.findMany({
          where: { awardId: mine.id },
          orderBy: { createdAt: 'asc' },
        });
        expect(events.map((e) => e.type)).toEqual(['awarded', 'rejected']);
        expect(events[1]).toMatchObject({
          actorId: people.owner.userId,
          reasonCode: 'SUSPECTED_ABUSE',
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'REJECTED',
        });
        // Settled once: rejecting twice is refused.
        expect((await review(mine.id, { decision: 'reject', reason: 'OTHER' })).status).toBe(409);
      });
    });

    describe('history', () => {
      it('remembers a rejected award when the same person wins again', async () => {
        // ama was rejected in an earlier test.
        const c = await settled('Prior rejection', { kind: 'CASH', amountMinor: 5000 });
        const row = (await businessView(c.id)).find((a) => a.name === 'rama');
        expect(row?.status).toBe('PENDING_REVIEW');
        expect(row?.riskReasons).toEqual(expect.arrayContaining(['PRIOR_REJECTION']));
        const clean = (await businessView(c.id)).find((a) => a.name === 'ryaw');
        expect(clean?.status).toBe('AVAILABLE');
      });
    });

    describe('rate limits', () => {
      it('hold across instances, because the count is in the database', async () => {
        const key = `limit-${tag}-${randomUUID()}`;
        const a = new PgRateLimiter(db, 'test', 2, 60_000);
        const b = new PgRateLimiter(db, 'test', 2, 60_000);
        await a.hit(key);
        await b.hit(key);
        await expect(a.hit(key)).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
        await expect(b.hit(key)).rejects.toMatchObject({ status: 429 });
        // Another key is not affected.
        await expect(a.hit(`${key}-other`)).resolves.toBeUndefined();
        await platform.rateLimitCounter.deleteMany({ where: { key: { contains: key } } });
      });

      it('stop a person from hammering claims', async () => {
        const c = await settled('Claim limit', { kind: 'CASH', amountMinor: 5000 });
        const yaw = await awardOf(people.yaw, c.id);
        // yaw has not verified an email, so each attempt is refused, but each still counts.
        let last = 0;
        for (let i = 0; i < 16; i++) {
          last = (await post(people.yaw, `my-rewards/${yaw.id}/claim`, mobile)).status;
          if (i < 15) expect(last).toBe(403);
        }
        expect(last).toBe(429);
      });
    });

    describe('scam reports', () => {
      it('are recorded once, ranked by reason, and never readable by the business', async () => {
        const c = await settled('Reports', { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        const url = `my-rewards/${ama.id}/report`;
        expect((await post(people.ama, url, { reason: 'NOPE' })).status).toBe(400);
        const sent = await post(people.ama, url, {
          reason: 'ASKED_TO_PAY',
          details: '  They asked for a fee  ',
        });
        expect(sent.status, JSON.stringify(sent.body)).toBe(201);
        expect(sent.body).toEqual({ reported: true });
        expect((await post(people.ama, url, { reason: 'ASKED_TO_PAY' })).status).toBe(201);
        const rows = await platform.scamReport.findMany({ where: { awardId: ama.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          userId: people.ama.userId,
          reason: 'ASKED_TO_PAY',
          severity: 80,
          status: 'OPEN',
          details: 'They asked for a fee',
        });
        // Another reason on the same award is a separate report.
        await post(people.ama, url, { reason: 'NOT_RECEIVED' });
        expect(await platform.scamReport.count({ where: { awardId: ama.id } })).toBe(2);

        // The business's own scope cannot read them, so it cannot tell who reported.
        const ctx = createTenantContext({ tenantId: tenantA, requestId: randomUUID() });
        expect(await withTenant(db, ctx, (tx) => tx.scamReport.findMany())).toEqual([]);
        // Nobody else can report on someone's award, and the reporter is the session's person.
        expect((await post(people.kofi, url, { reason: 'OTHER' })).status).toBe(404);
        expect((await post(people.owner, url, { reason: 'OTHER' })).status).toBe(403);
      });

      it('are limited per person per day', async () => {
        const c = await settled('Reports limit', { kind: 'CASH', amountMinor: 5000 });
        const kofi = await awardOf(people.kofi, c.id);
        let last = 0;
        for (let i = 0; i < 6; i++) {
          last = (await post(people.kofi, `my-rewards/${kofi.id}/report`, { reason: 'OTHER' }))
            .status;
        }
        expect(last).toBe(429);
      });
    });
  },
  60_000,
);

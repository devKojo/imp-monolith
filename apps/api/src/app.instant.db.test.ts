/**
 * End to end for rewards given as people qualify (ADR-R001): the real app, the real identity guards (session cookie,
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
import { createQuizModule } from './modules/quiz';
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
  'instant rewards end to end (real guards, real PostgreSQL)',
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
        data: { email: `iowner-${tag}@test.local`, name: 'iowner', emailVerifiedAt: new Date() },
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
          createdAt: new Date(Date.now() - 30 * 86_400_000),
          passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
          emailVerifiedAt: verified ? new Date() : null,
        },
      });
      userIds.push(user.id);
      return { ...(await session(user.id)), userId: user.id };
    }

    beforeAll(async () => {
      tenantA = (await platform.business.create({ data: { name: `E2E-IN-${tag}` } })).id;
      people.owner = await owner();
      people.ama = await participant('iama', true);
      people.kofi = await participant('ikofi', true);
      people.yaw = await participant('iyaw', false);

      const identity = createIdentityModule({
        db,
        allowedOrigins: [ORIGIN],
        sessionSecret: SECRET,
      });
      const templates = createTemplatesModule({ db, identity });
      rewards = createRewardsModule({ db, identity, dataKey: 'a-test-data-key-for-instant' });
      app = await createApp({
        bus: new InMemoryEventBus(),
        identity,
        templates,
        campaigns: createCampaignsModule({ db, identity, templates: templates.lookup }),
        giveaway: createGiveawayModule({ db, identity }),
        quiz: createQuizModule({ db, identity }),
        rewards,
      });
    });

    afterAll(async () => {
      const where = { tenantId: tenantA };
      await platform.quizAnswer.deleteMany({ where });
      await platform.quizAttempt.deleteMany({ where });
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
      await platform.participationSignal.deleteMany({ where: { tenantId: tenantA } });
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

    const put = (p: Person, path: string, body: object) =>
      request(app)
        .put(`/api/v1/${path}`)
        .set('Cookie', p.cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', p.csrf)
        .send(body);
    const code = (r: { body: { code?: string; error?: { code?: string } } }) =>
      r.body.error?.code ?? r.body.code;

    const field = (kind: string, label: string, over: Record<string, unknown> = {}) => ({
      kind,
      label,
      helper: '',
      required: false,
      options: [],
      correctIndex: null,
      ...over,
    });
    const RIGHT = [0, 1, 1];
    const questions = [
      field('quiz_question', 'Capital of Ghana?', {
        options: ['Accra', 'Kumasi', 'Tamale'],
        correctIndex: 0,
      }),
      field('quiz_question', '2 + 2?', { options: ['3', '4'], correctIndex: 1 }),
      field('quiz_question', 'Largest planet?', {
        options: ['Mars', 'Jupiter', 'Venus', 'Earth'],
        correctIndex: 1,
      }),
    ];
    const tier = (
      name: string,
      kind: 'CASH' | 'POINTS',
      amountMinor: number,
      selection: string | null,
    ) => ({
      name,
      valueLabel: '',
      winners: 1,
      description: '',
      kind,
      amountMinor,
      currency: kind === 'CASH' ? 'GHS' : null,
      selection,
    });

    /** A live quiz with tiered prizes, made through the real API. */
    async function liveQuiz(title: string, prizes: object[]) {
      const created = await post(people.owner, 'campaigns', { title, templateId: SEEDED.quiz });
      expect(created.status).toBe(201);
      const saved = await put(people.owner, `campaigns/${created.body.id}`, {
        expectedVersion: created.body.version,
        title,
        summary: 'Test yourself',
        templateId: SEEDED.quiz,
        startAt: null,
        endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        prizes,
        fields: [
          field('email', 'Email', { required: true }),
          field('consent', 'I agree', { required: true }),
          ...questions,
        ],
        settings: { quiz: { timeLimitMinutes: null, passPercent: 60, maxAttempts: 1 } },
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const launch = await post(people.owner, `campaigns/${created.body.id}/launch`, {
        expectedVersion: saved.body.version,
      });
      expect(launch.status, JSON.stringify(launch.body)).toBe(200);
      return { id: created.body.id as string, slug: launch.body.slug as string };
    }

    /** Starts the quiz and answers it, right or wrong, without finishing. */
    async function answered(p: Person, slug: string, right: boolean) {
      const started = await post(p, `quiz/${slug}/attempt`);
      expect(started.status, JSON.stringify(started.body)).toBe(200);
      const qs = started.body.questions as Array<{ id: string; options: string[] }>;
      for (const [n, q] of qs.entries()) {
        const choiceIndex = right ? RIGHT[n]! : (RIGHT[n]! + 1) % q.options.length;
        expect((await put(p, `quiz/${slug}/attempt/answers/${q.id}`, { choiceIndex })).status).toBe(
          204,
        );
      }
    }
    const submit = (p: Person, slug: string) => post(p, `quiz/${slug}/attempt/submit`);
    const myAward = async (p: Person, campaignId: string) =>
      (await read(p, 'my-rewards')).body.items.find(
        (a: { campaign: { id: string } }) => a.campaign.id === campaignId,
      ) as
        | {
            id: string;
            status: string;
            rank: number | null;
            kind: string;
            amountMinor: number | null;
            source: string;
          }
        | undefined;
    const clearSignals = (campaignId: string) =>
      platform.participationSignal.deleteMany({ where: { campaignId } });

    describe('awarding on a pass', () => {
      it('gives the first to pass the first tier, the next the next, and nothing once they are gone', async () => {
        const c = await liveQuiz('Tiers', [
          tier('1st', 'CASH', 5000, 'COMPLETION'),
          tier('2nd', 'CASH', 3000, 'COMPLETION'),
          tier('3rd', 'POINTS', 40, 'COMPLETION'),
        ]);
        const zed = await participant('ized', true);
        const ugo = await participant('iugo', true);
        const all = [people.ama, people.kofi, people.yaw, zed, ugo];
        await answered(people.ama, c.slug, true);
        await answered(people.kofi, c.slug, true);
        await answered(people.yaw, c.slug, false);
        await answered(zed, c.slug, true);
        await answered(ugo, c.slug, true);
        await clearSignals(c.id);
        expect(all).toHaveLength(5);

        // The first to finish takes first place.
        const first = await submit(people.ama, c.slug);
        expect(first.body.result.passed).toBe(true);
        const a1 = await myAward(people.ama, c.id);
        expect(a1).toMatchObject({
          status: 'AVAILABLE',
          rank: 1,
          kind: 'CASH',
          amountMinor: 5000,
          source: 'COMPLETION',
        });

        // Two finish at the same moment: they take 2nd and 3rd, never the same place.
        const both = await Promise.all([submit(people.kofi, c.slug), submit(zed, c.slug)]);
        expect(both.map((r) => r.status)).toEqual([200, 200]);
        const ranks = [
          (await myAward(people.kofi, c.id))?.rank,
          (await myAward(zed, c.id))?.rank,
        ].sort();
        expect(ranks).toEqual([2, 3]);

        // Failing wins nothing, and a pass after the last tier is gone wins nothing either.
        expect((await submit(people.yaw, c.slug)).body.result.passed).toBe(false);
        expect(await myAward(people.yaw, c.id)).toBeUndefined();
        expect((await submit(ugo, c.slug)).body.result.passed).toBe(true);
        expect(await myAward(ugo, c.id)).toBeUndefined();
        expect(await platform.rewardAward.count({ where: { campaignId: c.id } })).toBe(3);
        expect(
          await platform.rewardEvent.count({
            where: { award: { campaignId: c.id }, type: 'awarded' },
          }),
        ).toBe(3);
      });

      it('lets the winner claim in one step, and the business pay it', async () => {
        const c = await liveQuiz('Claim after pass', [tier('1st', 'CASH', 5000, 'COMPLETION')]);
        await answered(people.ama, c.slug, true);
        await clearSignals(c.id);
        await submit(people.ama, c.slug);
        const award = await myAward(people.ama, c.id);
        expect(award?.status).toBe('AVAILABLE');

        const claim = await post(people.ama, `my-rewards/${award!.id}/claim`, {
          ...mobile,
          destination: '+233 20 555 0201',
        });
        expect(claim.status, JSON.stringify(claim.body)).toBe(200);
        expect(claim.body.status).toBe('CLAIMED');

        const list = await read(people.owner, `rewards/campaigns/${c.id}/awards`);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0]).toMatchObject({
          status: 'CLAIMED',
          payoutHint: '••••0201',
          source: 'COMPLETION',
        });
        const paid = await post(people.owner, `rewards/awards/${award!.id}/fulfil`, {
          reference: 'MOMO-5001',
        });
        expect(paid.status).toBe(200);
        expect((await myAward(people.ama, c.id))?.status).toBe('FULFILLED');
      });

      it('holds a winner the risk rules cannot clear, and tells them only that it is being checked', async () => {
        const c = await liveQuiz('Held on pass', [tier('1st', 'CASH', 5000, 'COMPLETION')]);
        const zed = await participant('ized2', true);
        await answered(people.ama, c.slug, true);
        await answered(people.kofi, c.slug, true);
        await answered(zed, c.slug, true);
        // Everyone joined from one network and browser, so the rules notice.
        await platform.participationSignal.updateMany({
          where: { campaignId: c.id },
          data: { ipHash: 'ip-crowd-in', uaHash: 'ua-crowd-in' },
        });
        await submit(people.ama, c.slug);
        const award = await myAward(people.ama, c.id);
        expect(award?.status).toBe('PENDING_REVIEW');
        const detail = JSON.stringify((await read(people.ama, `my-rewards/${award!.id}`)).body);
        expect(detail).toContain('REVIEW_REQUIRED');
        expect(detail).not.toContain('SHARED_NETWORK');
        const row = (await read(people.owner, `rewards/campaigns/${c.id}/awards`)).body.items[0];
        expect(row.riskScore).toBeGreaterThanOrEqual(30);
        expect(row.riskReasons).toContain('SHARED_NETWORK');
        expect((await post(people.ama, `my-rewards/${award!.id}/claim`, mobile)).status).toBe(409);
      });

      it('leaves a campaign that is settled at the end alone', async () => {
        const c = await liveQuiz('Settled at the end', [tier('1st', 'CASH', 5000, null)]);
        await answered(people.ama, c.slug, true);
        await clearSignals(c.id);
        await submit(people.ama, c.slug);
        expect(await platform.rewardAward.count({ where: { campaignId: c.id } })).toBe(0);
      });

      it('has nothing to settle at the end when tiers go to the first to pass', async () => {
        const c = await liveQuiz('Nothing to settle', [tier('1st', 'CASH', 5000, 'COMPLETION')]);
        await platform.campaign.update({
          where: { id: c.id },
          data: { endAt: new Date(Date.now() - 60_000) },
        });
        const r = await post(people.owner, `rewards/campaigns/${c.id}/award`);
        expect(r.status).toBe(422);
        expect(JSON.stringify(r.body)).toContain('as people qualify');
      });
    });

    describe('recalling an award', () => {
      it('lets the business recall an unpaid award, and never a paid one', async () => {
        const c = await liveQuiz('Recall', [
          tier('1st', 'CASH', 5000, 'COMPLETION'),
          tier('2nd', 'CASH', 3000, 'COMPLETION'),
        ]);
        await answered(people.ama, c.slug, true);
        await answered(people.kofi, c.slug, true);
        await clearSignals(c.id);
        await submit(people.ama, c.slug);
        await submit(people.kofi, c.slug);
        const ama = (await myAward(people.ama, c.id))!;
        const kofi = (await myAward(people.kofi, c.id))!;
        const review = (id: string, body: object) =>
          post(people.owner, `rewards/awards/${id}/review`, body);

        // A reason is needed, and a participant cannot do it.
        expect((await review(kofi.id, { decision: 'revoke' })).status).toBe(400);
        expect(
          (
            await post(people.ama, `rewards/awards/${kofi.id}/review`, {
              decision: 'revoke',
              reason: 'OTHER',
            })
          ).status,
        ).toBe(403);

        // Recalled while still available: the winner can no longer claim it.
        const recalled = await review(kofi.id, { decision: 'revoke', reason: 'SUSPECTED_ABUSE' });
        expect(recalled.status, JSON.stringify(recalled.body)).toBe(200);
        expect(recalled.body.status).toBe('REVOKED');
        expect((await post(people.kofi, `my-rewards/${kofi.id}/claim`, mobile)).status).toBe(409);
        const event = await platform.rewardEvent.findFirstOrThrow({
          where: { awardId: kofi.id, type: 'revoked' },
        });
        expect(event).toMatchObject({
          actorId: people.owner.userId,
          fromStatus: 'AVAILABLE',
          toStatus: 'REVOKED',
          reasonCode: 'SUSPECTED_ABUSE',
        });

        // Recalled after a claim but before payment.
        const claim = await post(people.ama, `my-rewards/${ama.id}/claim`, {
          ...mobile,
          destination: '+233 20 555 0202',
        });
        expect(claim.body.status).toBe('CLAIMED');
        expect(
          (await review(ama.id, { decision: 'revoke', reason: 'SUSPECTED_ABUSE' })).body.status,
        ).toBe('REVOKED');
        expect(
          (await post(people.owner, `rewards/awards/${ama.id}/fulfil`, { reference: 'MOMO-1' }))
            .status,
        ).toBe(409);
        // Once recalled, it is final.
        expect(code(await review(ama.id, { decision: 'revoke', reason: 'OTHER' }))).toBeDefined();
        expect((await review(ama.id, { decision: 'revoke', reason: 'OTHER' })).status).toBe(409);
      });

      it('cannot recall an award that has been paid', async () => {
        const c = await liveQuiz('Paid is final', [tier('1st', 'CASH', 5000, 'COMPLETION')]);
        // ama was recalled in the previous test (the rules remember that), so someone with a clean record wins.
        const paid = await participant('ipaid', true);
        await answered(paid, c.slug, true);
        await clearSignals(c.id);
        await submit(paid, c.slug);
        const ama = (await myAward(paid, c.id))!;
        const claimed = await post(paid, `my-rewards/${ama.id}/claim`, {
          ...mobile,
          destination: '+233 20 555 0203',
        });
        expect(claimed.body.status, JSON.stringify(claimed.body)).toBe('CLAIMED');
        expect(
          (await post(people.owner, `rewards/awards/${ama.id}/fulfil`, { reference: 'MOMO-9' }))
            .status,
        ).toBe(200);
        const late = await post(people.owner, `rewards/awards/${ama.id}/review`, {
          decision: 'revoke',
          reason: 'OTHER',
        });
        expect(late.status).toBe(409);
        expect((await myAward(paid, c.id))?.status).toBe('FULFILLED');
      });
    });

    describe('setting it up', () => {
      const draft = async (templateId: string, prizes: object[], settings: object) => {
        const created = await post(people.owner, 'campaigns', { title: 'Setup', templateId });
        return put(people.owner, `campaigns/${created.body.id}`, {
          expectedVersion: created.body.version,
          title: 'Setup',
          summary: '',
          templateId,
          startAt: null,
          endAt: null,
          prizes,
          fields: [],
          settings,
        });
      };
      it('allows first-to-pass prizes only in a quiz or a survey, and only when every prize agrees', async () => {
        const giveaway = await draft(SEEDED.giveaway, [tier('1st', 'CASH', 100, 'COMPLETION')], {
          quiz: null,
        });
        expect(giveaway.status).toBe(422);
        expect(giveaway.body.error.message).toMatch(/quiz or a survey/);
        const mixed = await draft(
          SEEDED.quiz,
          [tier('1st', 'CASH', 100, 'COMPLETION'), tier('2nd', 'CASH', 50, null)],
          { quiz: { timeLimitMinutes: null, passPercent: 60, maxAttempts: 1 } },
        );
        expect(mixed.status).toBe(422);
        expect(mixed.body.error.message).toMatch(/same way/);
      });
    });
  },
  120_000,
);

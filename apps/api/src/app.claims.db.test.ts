/**
 * End to end for claiming a reward (ADR-R001, R3): the real app, the real identity guards (session cookie,
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
import { createRewardsModule, pointsBalance, type RewardsModule } from './modules/rewards';
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
  'claiming a reward end to end (real guards, real PostgreSQL)',
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
        data: { email: `cowner-${tag}@test.local`, name: 'cowner', emailVerifiedAt: new Date() },
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
          passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
          emailVerifiedAt: verified ? new Date() : null,
        },
      });
      userIds.push(user.id);
      return { ...(await session(user.id)), userId: user.id };
    }

    beforeAll(async () => {
      tenantA = (await platform.business.create({ data: { name: `E2E-CL-${tag}` } })).id;
      people.owner = await owner();
      people.ama = await participant('cama', true);
      people.kofi = await participant('ckofi', true);
      people.yaw = await participant('cyaw', false);

      const identity = createIdentityModule({
        db,
        allowedOrigins: [ORIGIN],
        sessionSecret: SECRET,
      });
      const templates = createTemplatesModule({ db, identity });
      rewards = createRewardsModule({ db, identity, dataKey: 'a-test-data-key-for-claims' });
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

    describe('points', () => {
      it('are credited to the ledger at once, once', async () => {
        const c = await settled('Points prize', { kind: 'POINTS', amountMinor: 40 });
        const mine = await awardOf(people.ama, c.id);
        const first = await post(people.ama, `my-rewards/${mine.id}/claim`);
        expect(first.status, JSON.stringify(first.body)).toBe(200);
        expect(first.body).toMatchObject({ status: 'FULFILLED', alreadyClaimed: false });
        const again = await post(people.ama, `my-rewards/${mine.id}/claim`);
        expect(again.body).toMatchObject({ status: 'FULFILLED', alreadyClaimed: true });

        const ctx = createTenantContext({ tenantId: tenantA, requestId: randomUUID() });
        const balance = await withTenant(db, ctx, (tx) =>
          pointsBalance(tx, tenantA, people.ama.userId),
        );
        expect(balance).toBe(40);

        const wallet = await read(people.ama, 'my-rewards/wallet');
        expect(wallet.body.items).toEqual([{ businessName: `E2E-CL-${tag}`, points: 40 }]);
        expect((await read(people.kofi, 'my-rewards/wallet')).body.items).toEqual([]);

        const detail = await read(people.ama, `my-rewards/${mine.id}`);
        expect(detail.body.events.map((e: { type: string }) => e.type)).toEqual([
          'awarded',
          'claimed',
          'fulfilled',
        ]);
        expect(JSON.stringify(detail.body)).not.toContain('actorId');
      });
    });

    describe('money', () => {
      it('needs a verified address, a valid destination and the password', async () => {
        const c = await settled('Cash prize', { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        const url = `my-rewards/${ama.id}/claim`;

        const noPassword = await post(people.ama, url, { ...mobile, password: undefined });
        expect(noPassword.status).toBe(422);
        const wrong = await post(people.ama, url, { ...mobile, password: 'not-my-password-1!' });
        expect(wrong.status).toBe(403);
        expect(wrong.body.error?.code ?? wrong.body.code).toBe('PASSWORD_CONFIRMATION_FAILED');
        const badNumber = await post(people.ama, url, { ...mobile, destination: 'abc' });
        expect(badNumber.status).toBe(422);
        // Nothing was claimed by any of that.
        expect((await read(people.ama, `my-rewards/${ama.id}`)).body.status).toBe('AVAILABLE');

        const yaw = await awardOf(people.yaw, c.id);
        const unverified = await post(people.yaw, `my-rewards/${yaw.id}/claim`, mobile);
        expect(unverified.status).toBe(403);
        expect(unverified.body.error?.code ?? unverified.body.code).toBe('EMAIL_NOT_VERIFIED');
      });

      it('stores the destination encrypted, shows only a masked hint, and cannot be claimed twice', async () => {
        const c = await settled('Cash prize 2', { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        const url = `my-rewards/${ama.id}/claim`;
        const done = await post(people.ama, url, mobile);
        expect(done.status, JSON.stringify(done.body)).toBe(200);
        expect(done.body).toMatchObject({
          status: 'CLAIMED',
          claimHint: '••••4567',
          alreadyClaimed: false,
        });

        const stored = await platform.rewardClaim.findFirstOrThrow({ where: { awardId: ama.id } });
        expect(stored.destinationEnc).not.toContain('2331234567');
        expect(rewards.box.decrypt(stored.destinationEnc)).toBe('+233241234567');
        expect(stored.destinationHash).toBe(rewards.box.fingerprint('MOBILE_MONEY:+233241234567'));
        const seen = JSON.stringify((await read(people.ama, `my-rewards/${ama.id}`)).body);
        expect(seen).not.toContain('2331234567');
        expect(seen).toContain('••••4567');

        const repeat = await post(people.ama, url, mobile);
        expect(repeat.body).toMatchObject({ status: 'CLAIMED', alreadyClaimed: true });
        expect(await platform.rewardClaim.count({ where: { awardId: ama.id } })).toBe(1);
        // A claim leaves a network signal behind.
        expect(
          await platform.participationSignal.count({ where: { campaignId: c.id, kind: 'CLAIM' } }),
        ).toBe(1);
      });

      it('goes through once when two claims race', async () => {
        const c = await settled('Cash prize 3', { kind: 'CASH', amountMinor: 5000 });
        const kofi = await awardOf(people.kofi, c.id);
        // Its own number: the destination rules would (rightly) hold a number other people have used.
        const own = { ...mobile, destination: '+233 20 555 0001' };
        const results = await Promise.all([
          post(people.kofi, `my-rewards/${kofi.id}/claim`, own),
          post(people.kofi, `my-rewards/${kofi.id}/claim`, own),
        ]);
        expect(results.map((r) => r.status)).toEqual([200, 200]);
        expect(results.filter((r) => r.body.alreadyClaimed === false)).toHaveLength(1);
        expect(await platform.rewardClaim.count({ where: { awardId: kofi.id } })).toBe(1);
        expect(
          await platform.rewardEvent.count({ where: { awardId: kofi.id, type: 'claimed' } }),
        ).toBe(1);
      });
    });

    describe('who may claim', () => {
      it('is only the winner, and only a participant account', async () => {
        const c = await settled('Cash prize 4', { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        // Someone else's award is indistinguishable from one that does not exist.
        expect((await post(people.kofi, `my-rewards/${ama.id}/claim`, mobile)).status).toBe(404);
        expect((await read(people.kofi, `my-rewards/${ama.id}`)).status).toBe(404);
        expect((await post(people.owner, `my-rewards/${ama.id}/claim`, mobile)).status).toBe(403);
        // And each person's list holds only their own.
        const kofiList = await read(people.kofi, 'my-rewards');
        expect(kofiList.body.items.some((a: { id: string }) => a.id === ama.id)).toBe(false);
        const item = kofiList.body.items[0];
        expect(item).toMatchObject({ businessName: `E2E-CL-${tag}`, needsDestination: true });
      });
    });

    describe('the deadline', () => {
      it('refuses a late claim, and the timeline says why', async () => {
        const c = await settled('Late prize', { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        await platform.rewardAward.update({
          where: { id: ama.id },
          data: { claimBy: new Date(Date.now() - 1000) },
        });

        // Reads as expired before anything has written that down.
        expect((await read(people.ama, `my-rewards/${ama.id}`)).body.status).toBe('EXPIRED');
        const late = await post(people.ama, `my-rewards/${ama.id}/claim`, mobile);
        expect(late.status).toBe(409);
        expect(late.body.error?.code ?? late.body.code).toBe('AWARD_EXPIRED');
        const detail = await read(people.ama, `my-rewards/${ama.id}`);
        expect(detail.body.events.at(-1)).toMatchObject({
          type: 'expired',
          reasonCode: 'CLAIM_WINDOW_ENDED',
        });
        // Still refused afterwards, and nothing was stored.
        expect((await post(people.ama, `my-rewards/${ama.id}/claim`, mobile)).status).toBe(409);
        expect(await platform.rewardClaim.count({ where: { awardId: ama.id } })).toBe(0);
      });

      it('cannot claim an award that is on hold', async () => {
        const c = await settled('Held prize', { kind: 'CASH', amountMinor: 5000 });
        const kofi = await awardOf(people.kofi, c.id);
        await platform.rewardAward.update({ where: { id: kofi.id }, data: { status: 'HELD' } });
        const r = await post(people.kofi, `my-rewards/${kofi.id}/claim`, mobile);
        expect(r.status).toBe(409);
        expect(r.body.error?.code ?? r.body.code).toBe('AWARD_NOT_CLAIMABLE');
      });
    });
  },
  60_000,
);

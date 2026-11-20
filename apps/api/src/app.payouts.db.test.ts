/**
 * End to end for paying out rewards and configuring prizes (ADR-R001, R4): the real app, the real identity guards (session cookie,
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
  'paying out rewards end to end (real guards, real PostgreSQL)',
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
        data: { email: `powner-${tag}@test.local`, name: 'powner', emailVerifiedAt: new Date() },
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
      tenantA = (await platform.business.create({ data: { name: `E2E-PO-${tag}` } })).id;
      people.owner = await owner();
      people.ama = await participant('pama', true);
      people.kofi = await participant('pkofi', true);
      people.yaw = await participant('pyaw', false);

      const identity = createIdentityModule({
        db,
        allowedOrigins: [ORIGIN],
        sessionSecret: SECRET,
      });
      const templates = createTemplatesModule({ db, identity });
      rewards = createRewardsModule({ db, identity, dataKey: 'a-test-data-key-for-payouts' });
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

    describe('prizes', () => {
      async function draft(prizes: object[]) {
        const created = await post(people.owner, 'campaigns', {
          title: `Prizes ${prizes.length}`,
          templateId: SEEDED.giveaway,
        });
        return request(app)
          .put(`/api/v1/campaigns/${created.body.id}`)
          .set('Cookie', people.owner.cookie)
          .set('Origin', ORIGIN)
          .set('X-CSRF-Token', people.owner.csrf)
          .send({
            expectedVersion: created.body.version,
            title: 'Prizes',
            summary: '',
            templateId: SEEDED.giveaway,
            startAt: null,
            endAt: null,
            prizes,
            fields: details,
            settings: { quiz: null },
          });
      }
      const base = { name: 'Cash', valueLabel: '', winners: 1, description: '' };

      it('keeps the kind, amount, currency and placing the business set', async () => {
        const saved = await draft([
          { ...base, kind: 'CASH', amountMinor: 500000, currency: 'ghs', rankFrom: 1, rankTo: 1 },
          {
            ...base,
            name: 'Points',
            kind: 'POINTS',
            amountMinor: 250,
            winners: 3,
            rankFrom: 2,
            rankTo: 4,
          },
          { ...base, name: 'Mug' },
        ]);
        expect(saved.status, JSON.stringify(saved.body)).toBe(200);
        const seen = saved.body.prizes.map((p: Record<string, unknown>) => [
          p.kind,
          p.amountMinor,
          p.currency,
          p.rankFrom,
          p.rankTo,
        ]);
        expect(seen).toEqual([
          ['CASH', 500000, 'GHS', 1, 1],
          ['POINTS', 250, null, 2, 4],
          ['ITEM', null, null, null, null],
        ]);
      });

      it('refuses cash without a currency, and overlapping or mismatched placings', async () => {
        expect((await draft([{ ...base, kind: 'CASH', amountMinor: 100 }])).status).toBe(422);
        const overlap = await draft([
          { ...base, rankFrom: 1, rankTo: 1 },
          { ...base, rankFrom: 1, rankTo: 1 },
        ]);
        expect(overlap.status).toBe(422);
        const mismatch = await draft([{ ...base, winners: 2, rankFrom: 1, rankTo: 1 }]);
        expect(mismatch.status).toBe(422);
      });
    });

    describe('payouts', () => {
      const claimed = async (title: string) => {
        const c = await settled(title, { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        const done = await post(people.ama, `my-rewards/${ama.id}/claim`, mobile);
        expect(done.status, JSON.stringify(done.body)).toBe(200);
        return { c, ama };
      };
      const code = (r: { body: { code?: string; error?: { code?: string } } }) =>
        r.body.error?.code ?? r.body.code;

      it('shows the business a masked hint, the full destination only on request, and records each view', async () => {
        const { c, ama } = await claimed('Payout 1');
        const list = await read(people.owner, `rewards/campaigns/${c.id}/awards`);
        const row = list.body.items.find((a: { id: string }) => a.id === ama.id);
        expect(row).toMatchObject({
          status: 'CLAIMED',
          payoutMethod: 'MOBILE_MONEY',
          payoutHint: '••••4567',
        });
        expect(JSON.stringify(list.body)).not.toContain('2331234567');

        const shown = await read(people.owner, `rewards/awards/${ama.id}/destination`);
        expect(shown.status, JSON.stringify(shown.body)).toBe(200);
        expect(shown.body).toMatchObject({
          destination: '+233241234567',
          accountName: 'Ama Mensah',
          amountMinor: 5000,
          currency: 'GHS',
        });
        const views = await platform.rewardEvent.findMany({
          where: { awardId: ama.id, type: 'destination_viewed' },
        });
        expect(views).toHaveLength(1);
        expect(views[0]?.actorId).toBe(people.owner.userId);
        // The winner's own timeline does not show who looked.
        const mine = JSON.stringify((await read(people.ama, `my-rewards/${ama.id}`)).body);
        expect(mine).not.toContain(people.owner.userId);
      });

      it('marks paid once, with the business reference', async () => {
        const { ama } = await claimed('Payout 2');
        const url = `rewards/awards/${ama.id}/fulfil`;
        expect((await post(people.owner, url, { reference: 'x' })).status).toBe(400);
        const results = await Promise.all([
          post(people.owner, url, { reference: 'MOMO-8841' }),
          post(people.owner, url, { reference: 'MOMO-8841' }),
        ]);
        expect(results.map((r) => r.status)).toEqual([200, 200]);
        expect(results.filter((r) => r.body.alreadyPaid === false)).toHaveLength(1);
        expect(
          await platform.rewardEvent.count({ where: { awardId: ama.id, type: 'fulfilled' } }),
        ).toBe(1);
        expect((await read(people.ama, `my-rewards/${ama.id}`)).body.status).toBe('FULFILLED');
      });

      it('refuses what is not claimed, not found, or not a business to pay', async () => {
        const c = await settled('Payout 3', { kind: 'CASH', amountMinor: 5000 });
        const kofi = await awardOf(people.kofi, c.id);
        const body = { reference: 'MOMO-1' };
        const early = await post(people.owner, `rewards/awards/${kofi.id}/fulfil`, body);
        expect(early.status).toBe(409);
        expect(code(early)).toBe('AWARD_NOT_PAYABLE');
        const unseen = await read(people.owner, `rewards/awards/${kofi.id}/destination`);
        expect(unseen.status).toBe(404);
        const missing = await post(people.owner, `rewards/awards/${randomUUID()}/fulfil`, body);
        expect(missing.status).toBe(404);
        // A participant is not a business.
        expect((await post(people.ama, `rewards/awards/${kofi.id}/fulfil`, body)).status).toBe(403);
        expect((await read(people.ama, `rewards/awards/${kofi.id}/destination`)).status).toBe(403);
      });

      it('exports a CSV without full destinations', async () => {
        const { c } = await claimed('Payout 4');
        const csv = await read(people.owner, `rewards/campaigns/${c.id}/awards/export`);
        expect(csv.status).toBe(200);
        expect(csv.headers['content-type']).toMatch(/text\/csv/);
        expect(csv.text.split('\r\n')[0]).toMatch(/^Place,Winner/);
        expect(csv.text).toContain('••••4567');
        expect(csv.text).not.toContain('2331234567');
      });
    });
  },
  60_000,
);

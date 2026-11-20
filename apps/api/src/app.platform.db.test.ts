/**
 * End to end for platform review of rewards (ADR-R001, R6): the real app, the real identity guards (session cookie,
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
import { createAdministrationModule } from './modules/administration';
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
  'platform review end to end (real guards, real PostgreSQL)',
  () => {
    const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 8 });
    const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
    const tag = randomUUID().slice(0, 8);

    type Person = { cookie: string; csrf: string; userId: string };
    let tenantA = '';
    let tenantB = '';
    const people = {} as Record<'owner' | 'ownerB' | 'staff' | 'ama' | 'kofi' | 'yaw', Person>;
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
        data: { email: `xowner-${tag}@test.local`, name: 'xowner', emailVerifiedAt: new Date() },
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
      tenantA = (await platform.business.create({ data: { name: `E2E-PL-${tag}` } })).id;
      people.owner = await owner();
      people.ama = await participant('xama', true);
      people.kofi = await participant('xkofi', true);
      people.yaw = await participant('xyaw', false);

      const identity = createIdentityModule({
        db,
        allowedOrigins: [ORIGIN],
        sessionSecret: SECRET,
      });
      const templates = createTemplatesModule({ db, identity });
      rewards = createRewardsModule({ db, identity, dataKey: 'a-test-data-key-for-platform' });
      const administration = createAdministrationModule({ db: platform, identity });
      app = await createApp({
        bus: new InMemoryEventBus(),
        identity,
        templates,
        campaigns: createCampaignsModule({ db, identity, templates: templates.lookup }),
        giveaway: createGiveawayModule({ db, identity }),
        rewards,
        administration,
      });
    });

    afterAll(async () => {
      const where = { tenantId: { in: [tenantA, tenantB] } };
      await platform.scamReport.deleteMany({ where });
      await platform.platformStaff.deleteMany({ where: { userId: { in: userIds } } });
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
      await platform.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
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
      tune?: (campaignId: string) => Promise<void>,
      by: Person = people.owner,
    ) {
      const created = await post(by, 'campaigns', { title, templateId: SEEDED.giveaway });
      expect(created.status).toBe(201);
      const saved = await request(app)
        .put(`/api/v1/campaigns/${created.body.id}`)
        .set('Cookie', by.cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', by.csrf)
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
      const launch = await post(by, `campaigns/${created.body.id}/launch`, {
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
      else await platform.participationSignal.deleteMany({ where: { campaignId: id } });
      expect((await post(by, `rewards/campaigns/${id}/draw/seal`)).status).toBe(200);
      await platform.rewardDraw.updateMany({
        where: { campaignId: id },
        data: { sealedAt: new Date(Date.now() - 3_600_000) },
      });
      await platform.campaign.update({
        where: { id },
        data: { endAt: new Date(Date.now() - 60_000) },
      });
      const made = await post(by, `rewards/campaigns/${id}/award`);
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

    beforeAll(async () => {
      tenantB = (await platform.business.create({ data: { name: `E2E-PL-B-${tag}` } })).id;
      const user = await platform.user.create({
        data: { email: `xownerb-${tag}@test.local`, name: 'xownerb', emailVerifiedAt: new Date() },
      });
      userIds.push(user.id);
      const membership = await platform.membership.create({
        data: { tenantId: tenantB, userId: user.id, role: 'BUSINESS_OWNER' },
      });
      people.ownerB = {
        ...(await session(user.id, { tenantId: tenantB, membershipId: membership.id })),
        userId: user.id,
      };
      people.staff = await participant('xstaff', true);
      await platform.platformStaff.create({ data: { userId: people.staff.userId } });
    });

    const code = (r: { body: { code?: string; error?: { code?: string } } }) =>
      r.body.error?.code ?? r.body.code;
    const queue = async () =>
      (await read(people.staff, 'platform/reviews?limit=50')).body.items as Array<{
        awardId: string;
        status: string;
        riskScore: number;
        riskReasons: string[];
        businessName: string;
        campaignTitle: string;
        winnerName: string;
        crossBusiness: { destinationBusinesses: number; networkBusinesses: number };
      }>;
    const decide = (awardId: string, body: object, who: Person = people.staff) =>
      post(who, `platform/awards/${awardId}/decision`, body);
    const crowd = async (campaignId: string) => {
      await platform.participationSignal.updateMany({
        where: { campaignId },
        data: { ipHash: 'ip-crowd-pl', uaHash: 'ua-crowd-pl' },
      });
    };

    describe('who may use it', () => {
      it('is for platform staff only', async () => {
        for (const who of [people.owner, people.ama]) {
          expect((await read(who, 'platform/me')).status).toBe(403);
          expect((await read(who, 'platform/reviews')).status).toBe(403);
          expect((await read(who, 'platform/reports')).status).toBe(403);
        }
        expect(
          (
            await post(people.owner, `platform/awards/${randomUUID()}/decision`, {
              decision: 'release',
              password: PASSWORD,
            })
          ).status,
        ).toBe(403);
        expect((await request(app).get('/api/v1/platform/me')).status).toBe(401);
        const me = await read(people.staff, 'platform/me');
        expect(me.status).toBe(200);
        expect(me.body).toEqual({ staff: true });
      });

      it('stops when staff access is revoked', async () => {
        const temp = await participant('xtemp', true);
        await platform.platformStaff.create({ data: { userId: temp.userId } });
        expect((await read(temp, 'platform/me')).status).toBe(200);
        await platform.platformStaff.update({
          where: { userId: temp.userId },
          data: { revokedAt: new Date() },
        });
        expect((await read(temp, 'platform/me')).status).toBe(403);
      });
    });

    describe('the review queue', () => {
      it('lists held awards across businesses, riskiest first, with what else is known', async () => {
        // Business A: ama claims with a number. Business B: ama and kofi use the same number, so kofi is held.
        const number = { ...mobile, destination: '+233 20 555 0100' };
        const a = await settled('Cross A', { kind: 'CASH', amountMinor: 5000 });
        expect(
          (
            await post(
              people.ama,
              `my-rewards/${(await awardOf(people.ama, a.id)).id}/claim`,
              number,
            )
          ).status,
        ).toBe(200);
        // kofi joined A and B from the same network.
        await platform.participationSignal.create({
          data: {
            tenantId: tenantA,
            campaignId: a.id,
            userId: people.kofi.userId,
            kind: 'JOIN',
            ipHash: 'ip-xb-pl',
            uaHash: 'ua-x',
          },
        });

        const b = await settled(
          'Cross B',
          { kind: 'CASH', amountMinor: 7000 },
          async (id) => {
            const set = (userId: string, ipHash: string) =>
              platform.participationSignal.updateMany({
                where: { campaignId: id, userId },
                data: { ipHash, uaHash: `ua-${ipHash}` },
              });
            await set(people.ama.userId, 'ip-b-ama');
            await set(people.kofi.userId, 'ip-xb-pl');
            await set(people.yaw.userId, 'ip-b-yaw');
          },
          people.ownerB,
        );
        const amaB = await awardOf(people.ama, b.id);
        const kofiB = await awardOf(people.kofi, b.id);
        expect((await post(people.ama, `my-rewards/${amaB.id}/claim`, number)).body.status).toBe(
          'CLAIMED',
        );
        const held = await post(people.kofi, `my-rewards/${kofiB.id}/claim`, {
          ...number,
          accountName: 'Kofi',
        });
        expect(held.body.status, JSON.stringify(held.body)).toBe('HELD');

        const items = await queue();
        const item = items.find((i) => i.awardId === kofiB.id);
        expect(item).toBeTruthy();
        expect(item).toMatchObject({
          status: 'HELD',
          businessName: `E2E-PL-B-${tag}`,
          campaignTitle: 'Cross B',
          winnerName: 'xkofi',
        });
        expect(item?.riskReasons).toContain('DESTINATION_REUSE');
        expect(item?.crossBusiness.destinationBusinesses).toBe(1);
        expect(item?.crossBusiness.networkBusinesses).toBe(1);
        // Riskiest first.
        const scores = items.map((i) => i.riskScore);
        expect(scores).toEqual([...scores].sort((x, y) => y - x));
        // No destination, account number or hash is ever in the queue.
        const raw = JSON.stringify((await read(people.staff, 'platform/reviews?limit=50')).body);
        expect(raw).not.toContain('2335550100');
        expect(raw).not.toContain('destinationHash');
        expect(raw).not.toContain('accountName');
      });
    });

    describe('decisions', () => {
      it('releases a flagged award the business could not, with a password, and says who', async () => {
        const c = await settled('Flagged', { kind: 'CASH', amountMinor: 5000 }, crowd);
        const ama = await awardOf(people.ama, c.id);
        expect(ama.status).toBe('PENDING_REVIEW');
        // A business cannot release it.
        const byBusiness = await post(people.owner, `rewards/awards/${ama.id}/review`, {
          decision: 'release',
        });
        expect(code(byBusiness)).toBe('PLATFORM_REVIEW_REQUIRED');

        expect((await decide(ama.id, { decision: 'release' })).status).toBe(400);
        const wrong = await decide(ama.id, { decision: 'release', password: 'not-my-password-1!' });
        expect(wrong.status).toBe(403);
        expect(code(wrong)).toBe('PASSWORD_CONFIRMATION_FAILED');
        expect(
          (await platform.rewardAward.findUniqueOrThrow({ where: { id: ama.id } })).status,
        ).toBe('PENDING_REVIEW');

        const done = await decide(ama.id, {
          decision: 'release',
          password: PASSWORD,
          note: '  Checked: a family on one connection  ',
        });
        expect(done.status, JSON.stringify(done.body)).toBe(200);
        expect(done.body).toEqual({ awardId: ama.id, status: 'AVAILABLE' });
        const row = await platform.rewardAward.findUniqueOrThrow({ where: { id: ama.id } });
        expect(row.claimBy && row.claimBy.getTime() > Date.now() + 13 * 86_400_000).toBe(true);
        const event = await platform.rewardEvent.findFirstOrThrow({
          where: { awardId: ama.id, type: 'platform_released' },
        });
        expect(event).toMatchObject({
          actorId: people.staff.userId,
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'AVAILABLE',
          reasonCode: 'PLATFORM_REVIEWED',
        });
        expect(event.metadata).toMatchObject({
          platform: true,
          note: 'Checked: a family on one connection',
        });

        // The winner sees it moved on; neither the reviewer nor the note.
        const seen = JSON.stringify((await read(people.ama, `my-rewards/${ama.id}`)).body);
        expect(seen).toContain('PLATFORM_REVIEWED');
        expect(seen).not.toContain(people.staff.userId);
        expect(seen).not.toContain('family');
        const claim = await post(people.ama, `my-rewards/${ama.id}/claim`, {
          ...mobile,
          destination: '+233 20 555 0101',
        });
        expect(claim.status, JSON.stringify(claim.body)).toBe(200);
        // Decided once: the same decision again is refused.
        const again = await decide(ama.id, { decision: 'release', password: PASSWORD });
        expect(again.status).toBe(409);
        expect(code(again)).toBe('DECISION_NOT_ALLOWED');
      });

      it('rejects and revokes, and cannot change what is already paid or ended', async () => {
        const c = await settled('Revoke', { kind: 'CASH', amountMinor: 5000 }, crowd);
        const ama = await awardOf(people.ama, c.id);
        const kofi = await awardOf(people.kofi, c.id);
        const rejected = await decide(ama.id, {
          decision: 'reject',
          password: PASSWORD,
          note: 'Duplicate identity',
        });
        expect(rejected.body.status).toBe('REJECTED');
        // Revoke works on an award that was released but not yet paid.
        expect(
          (await decide(kofi.id, { decision: 'release', password: PASSWORD })).body.status,
        ).toBe('AVAILABLE');
        const revoked = await decide(kofi.id, { decision: 'revoke', password: PASSWORD });
        expect(revoked.body.status).toBe('REVOKED');
        expect((await read(people.kofi, `my-rewards/${kofi.id}`)).body.status).toBe('REVOKED');
        // An ended award is final; a paid one cannot be revoked.
        expect((await decide(ama.id, { decision: 'revoke', password: PASSWORD })).status).toBe(409);
        await platform.rewardAward.update({
          where: { id: kofi.id },
          data: { status: 'FULFILLED' },
        });
        expect((await decide(kofi.id, { decision: 'revoke', password: PASSWORD })).status).toBe(
          409,
        );
        expect(
          (await decide(randomUUID(), { decision: 'reject', password: PASSWORD })).status,
        ).toBe(404);
      });
    });

    describe('scam reports', () => {
      it('are ranked, scored per business, and resolved once', async () => {
        const c = await settled('Reported', { kind: 'CASH', amountMinor: 5000 });
        const ama = await awardOf(people.ama, c.id);
        const kofi = await awardOf(people.kofi, c.id);
        await post(people.ama, `my-rewards/${ama.id}/report`, {
          reason: 'ASKED_TO_PAY',
          details: 'Wanted a fee',
        });
        await post(people.kofi, `my-rewards/${kofi.id}/report`, { reason: 'NOT_RECEIVED' });

        const list = await read(people.staff, 'platform/reports');
        expect(list.status, JSON.stringify(list.body)).toBe(200);
        const mine = list.body.items.filter(
          (r: { campaignTitle: string }) => r.campaignTitle === 'Reported',
        );
        expect(mine).toHaveLength(2);
        expect(mine[0]).toMatchObject({
          reason: 'ASKED_TO_PAY',
          severity: 80,
          reporterName: 'xama',
          status: 'OPEN',
          details: 'Wanted a fee',
        });
        // Two different winners reported this business: the worst reason plus ten for the second person.
        expect(mine[0].businessScamScore).toBeGreaterThanOrEqual(90);
        const severities = list.body.items.map((r: { severity: number }) => r.severity);
        expect(severities).toEqual([...severities].sort((x: number, y: number) => y - x));

        const first = await post(people.staff, `platform/reports/${mine[0].id}/resolve`, {
          status: 'REVIEWED',
          note: 'Business warned',
        });
        expect(first.body).toEqual({ reportId: mine[0].id, status: 'REVIEWED' });
        const row = await platform.scamReport.findUniqueOrThrow({ where: { id: mine[0].id } });
        expect(row).toMatchObject({
          status: 'REVIEWED',
          resolvedById: people.staff.userId,
          resolution: 'Business warned',
        });
        // A second reviewer does not overwrite it.
        const second = await post(people.staff, `platform/reports/${mine[0].id}/resolve`, {
          status: 'DISMISSED',
        });
        expect(second.body.status).toBe('REVIEWED');
        const open = await read(people.staff, 'platform/reports?status=OPEN');
        expect(open.body.items.some((r: { id: string }) => r.id === mine[0].id)).toBe(false);
        expect(
          (
            await post(people.staff, `platform/reports/${randomUUID()}/resolve`, {
              status: 'DISMISSED',
            })
          ).status,
        ).toBe(404);
        expect(
          (
            await post(people.owner, `platform/reports/${mine[1].id}/resolve`, {
              status: 'DISMISSED',
            })
          ).status,
        ).toBe(403);
      });
    });
  },
  60_000,
);

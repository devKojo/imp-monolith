/**
 * End to end for settling a campaign (ADR-R001, R2): the real app, the real identity guards (session cookie,
 * CSRF, Origin), the real routes and real PostgreSQL with the real roles and RLS. Sessions are created
 * directly in the test database. Skipped unless the same TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as
 * the isolation suite are set.
 */
import { randomUUID } from 'node:crypto';
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
import {
  appendPoints,
  createRewardsModule,
  pointsBalance,
  verifyDraw,
  type PublishedDraw,
} from './modules/rewards';
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

describe.skipIf(!enabled)('settling a campaign end to end (real guards, real PostgreSQL)', () => {
  const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
  const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
  const tag = randomUUID().slice(0, 8);

  type Person = { cookie: string; csrf: string; userId: string };
  let tenantA = '';
  let tenantB = '';
  const people = {} as Record<'owner' | 'outsider' | 'ama' | 'kofi' | 'yaw', Person>;
  const userIds: string[] = [];
  let app: Awaited<ReturnType<typeof createApp>>;

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

  async function business(tenantId: string, name: string): Promise<Person> {
    const user = await platform.user.create({
      data: { email: `${name}-${tag}@test.local`, name, emailVerifiedAt: new Date() },
    });
    userIds.push(user.id);
    const membership = await platform.membership.create({
      data: { tenantId, userId: user.id, role: 'BUSINESS_OWNER' },
    });
    return {
      ...(await session(user.id, { tenantId, membershipId: membership.id })),
      userId: user.id,
    };
  }

  async function participant(name: string): Promise<Person> {
    const user = await platform.user.create({
      data: {
        email: `${name}-${tag}@test.local`,
        name,
        accountType: 'PARTICIPANT',
        emailVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);
    return { ...(await session(user.id)), userId: user.id };
  }

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      platform.business.create({ data: { name: `E2E-RA-${tag}` } }),
      platform.business.create({ data: { name: `E2E-RB-${tag}` } }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    people.owner = await business(tenantA, 'rowner');
    people.outsider = await business(tenantB, 'routsider');
    people.ama = await participant('rama');
    people.kofi = await participant('rkofi');
    people.yaw = await participant('ryaw');

    const identity = createIdentityModule({ db, allowedOrigins: [ORIGIN], sessionSecret: SECRET });
    const templates = createTemplatesModule({ db, identity });
    app = await createApp({
      bus: new InMemoryEventBus(),
      identity,
      templates,
      campaigns: createCampaignsModule({ db, identity, templates: templates.lookup }),
      giveaway: createGiveawayModule({ db, identity }),
      rewards: createRewardsModule({ db, identity }),
    });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
    const where = { tenantId: { in: tenants } };
    await platform.pointsLedger.deleteMany({ where });
    await platform.rewardEvent.deleteMany({ where });
    await platform.rewardAward.deleteMany({ where });
    await platform.rewardDraw.deleteMany({ where });
    await platform.participationSignal.deleteMany({ where });
    await platform.quizAttempt.deleteMany({ where });
    await platform.giveawayEntry.deleteMany({ where });
    await platform.campaignPrize.deleteMany({ where });
    await platform.campaign.deleteMany({ where });
    await platform.session.deleteMany({ where: { userId: { in: userIds } } });
    await platform.membership.deleteMany({ where });
    await platform.user.deleteMany({ where: { id: { in: userIds } } });
    await platform.business.deleteMany({ where: { id: { in: tenants } } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  const read = (p: Person | null, path: string) => {
    const r = request(app).get(`/api/v1/${path}`);
    return p ? r.set('Cookie', p.cookie) : r;
  };
  const write = (p: Person, path: string, body: object = {}) =>
    request(app)
      .post(`/api/v1/${path}`)
      .set('Cookie', p.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', p.csrf)
      .send(body);

  const details = [
    { kind: 'email', label: 'Email', helper: '', required: true, options: [], correctIndex: null },
    {
      kind: 'consent',
      label: 'I agree',
      helper: '',
      required: true,
      options: [],
      correctIndex: null,
    },
  ];

  async function launched(title: string, over: { prizes?: unknown[]; settings?: object } = {}) {
    const created = await (async () => {
      const r = await request(app)
        .post('/api/v1/campaigns')
        .set('Cookie', people.owner.cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', people.owner.csrf)
        .send({ title, templateId: SEEDED.giveaway });
      expect(r.status).toBe(201);
      return r.body;
    })();
    const saved = await request(app)
      .put(`/api/v1/campaigns/${created.id}`)
      .set('Cookie', people.owner.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', people.owner.csrf)
      .send({
        expectedVersion: created.version,
        title,
        summary: 'Win',
        templateId: SEEDED.giveaway,
        startAt: null,
        endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        prizes: over.prizes ?? [],
        fields: details,
        settings: { quiz: null, ...over.settings },
      });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const launch = await write(people.owner, `campaigns/${created.id}/launch`, {
      expectedVersion: saved.body.version,
    });
    expect(launch.status, JSON.stringify(launch.body)).toBe(200);
    return { id: created.id as string, slug: launch.body.slug as string };
  }

  /** Closes the campaign by moving its end into the past (the schedule would do this in time). */
  const close = async (id: string) => {
    // The seal happened while the campaign was open, so it predates the new end date.
    await platform.rewardDraw.updateMany({
      where: { campaignId: id },
      data: { sealedAt: new Date(Date.now() - 3_600_000) },
    });
    await platform.campaign.update({
      where: { id },
      data: { endAt: new Date(Date.now() - 60_000) },
    });
  };
  const enter = (slug: string, ...who: Person[]) =>
    Promise.all(who.map((p) => write(p, `giveaway/${slug}/entry`)));

  const prizes = [{ name: 'Grant', valueLabel: '$100', winners: 2, description: '' }];

  describe('a draw', () => {
    it('is sealed first, drawn once, and anyone can verify it', async () => {
      const c = await launched('Drawn giveaway', { prizes });
      await enter(c.slug, people.ama, people.kofi, people.yaw);

      // Too early, and the wrong person.
      expect((await write(people.owner, `rewards/campaigns/${c.id}/award`)).status).toBe(409);
      expect((await write(people.outsider, `rewards/campaigns/${c.id}/draw/seal`)).status).toBe(
        404,
      );
      expect((await write(people.ama, `rewards/campaigns/${c.id}/draw/seal`)).status).toBe(403);

      const sealed = await write(people.owner, `rewards/campaigns/${c.id}/draw/seal`);
      expect(sealed.status, JSON.stringify(sealed.body)).toBe(200);
      expect(sealed.body).not.toHaveProperty('nonce');
      // Sealing again returns the same commitment.
      const again = await write(people.owner, `rewards/campaigns/${c.id}/draw/seal`);
      expect(again.body.rulesHash).toBe(sealed.body.rulesHash);
      // Nothing to verify until the draw is made.
      expect((await read(null, `public/rewards/draws/${sealed.body.id}`)).status).toBe(404);

      await close(c.id);
      const made = await write(people.owner, `rewards/campaigns/${c.id}/award`);
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      expect(made.body).toMatchObject({ selection: 'DRAW', awarded: 2 });

      // Once only, even at the same moment.
      expect((await write(people.owner, `rewards/campaigns/${c.id}/award`)).status).toBe(409);

      const list = await read(people.owner, `rewards/campaigns/${c.id}/awards`);
      expect(list.body.items).toHaveLength(2);
      expect(list.body.items.every((a: { status: string }) => a.status === 'AVAILABLE')).toBe(true);
      expect(
        await platform.rewardEvent.count({ where: { tenantId: tenantA, type: 'awarded' } }),
      ).toBeGreaterThanOrEqual(2);
      expect((await read(people.outsider, `rewards/campaigns/${c.id}/awards`)).status).toBe(404);

      const pub = await read(null, `public/rewards/draws/${sealed.body.id}`);
      expect(pub.status).toBe(200);
      const draw = pub.body as PublishedDraw;
      expect(draw.entrants).toHaveLength(3);
      expect(JSON.stringify(draw)).not.toContain(people.ama.userId);
      expect(verifyDraw(draw)).toBe(true);
      expect(verifyDraw({ ...draw, entrants: draw.entrants.slice(1) })).toBe(false);
    });

    it('cannot be drawn if it was not sealed before the campaign closed', async () => {
      const c = await launched('Unsealed giveaway', { prizes });
      await enter(c.slug, people.ama);
      await close(c.id);
      const r = await write(people.owner, `rewards/campaigns/${c.id}/award`);
      expect(r.status).toBe(409);
      expect(r.body.error?.code ?? r.body.code).toBe('DRAW_NOT_SEALED');
      // And it cannot be sealed after the close.
      expect((await write(people.owner, `rewards/campaigns/${c.id}/draw/seal`)).status).toBe(409);
    });

    it('settles only once when two settlements race', async () => {
      const c = await launched('Racing giveaway', { prizes });
      await enter(c.slug, people.ama, people.kofi, people.yaw);
      await write(people.owner, `rewards/campaigns/${c.id}/draw/seal`);
      await close(c.id);
      const results = await Promise.all([
        write(people.owner, `rewards/campaigns/${c.id}/award`),
        write(people.owner, `rewards/campaigns/${c.id}/award`),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await platform.rewardAward.count({ where: { campaignId: c.id } })).toBe(2);
    });
  });

  describe('a prize pool', () => {
    it('gives every participant the same share once the pool is full', async () => {
      const c = await launched('Pool giveaway', {
        settings: { pool: { kind: 'POINTS', amount: 100, currency: null, maxParticipants: 3 } },
      });
      await enter(c.slug, people.ama, people.kofi, people.yaw);
      // Full: settles without waiting for the end date.
      const made = await write(people.owner, `rewards/campaigns/${c.id}/award`);
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      expect(made.body).toMatchObject({ selection: 'POOL', awarded: 3, draw: null });
      const list = await read(people.owner, `rewards/campaigns/${c.id}/awards`);
      expect(
        list.body.items.map((a: { amountMinor: number; kind: string }) => [a.kind, a.amountMinor]),
      ).toEqual([
        ['POINTS', 33],
        ['POINTS', 33],
        ['POINTS', 33],
      ]);
      expect((await write(people.owner, `rewards/campaigns/${c.id}/award`)).status).toBe(409);
    });
  });

  describe('a ranking', () => {
    it('awards the best finished attempts the places in order', async () => {
      // A launched campaign is turned into a quiz directly in the database: the quiz routes are covered
      // elsewhere, this test is about settling the scores.
      const c = await launched('Ranked quiz', {
        prizes: [
          { name: 'First', valueLabel: '', winners: 1, description: '' },
          { name: 'Second', valueLabel: '', winners: 1, description: '' },
        ],
      });
      await platform.campaign.update({ where: { id: c.id }, data: { templateId: SEEDED.quiz } });
      const at = (s: number) => new Date(Date.now() - 3600_000 + s * 1000);
      const attempt = (who: Person, n: number, score: number, s: number, passed = true) =>
        platform.quizAttempt.create({
          data: {
            tenantId: tenantA,
            campaignId: c.id,
            userId: who.userId,
            attemptNumber: n,
            score,
            total: 10,
            passed,
            startedAt: at(s - 1),
            submittedAt: at(s),
          },
        });
      await attempt(people.ama, 1, 6, 1);
      await attempt(people.ama, 2, 9, 5); // a retake: the best counts
      await attempt(people.kofi, 1, 9, 3); // ties on 9 but finished earlier
      await attempt(people.yaw, 1, 10, 2, false); // failed: not eligible
      await close(c.id);

      const made = await write(people.owner, `rewards/campaigns/${c.id}/award`);
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      expect(made.body).toMatchObject({ selection: 'RANKING', awarded: 2 });
      const items = (await read(people.owner, `rewards/campaigns/${c.id}/awards`)).body.items;
      expect(items.map((a: { userId: string; rank: number }) => [a.rank, a.userId])).toEqual([
        [1, people.kofi.userId],
        [2, people.ama.userId],
      ]);
    });
  });

  describe('the points ledger', () => {
    it('credits an award once, however many times it is retried', async () => {
      const ctx = createTenantContext({ tenantId: tenantA, requestId: randomUUID() });
      const entry = {
        tenantId: tenantA,
        userId: people.ama.userId,
        delta: 40,
        reason: 'award',
        idempotencyKey: `award:${tag}`,
      };
      const first = await withTenant(db, ctx, (tx) => appendPoints(tx, entry));
      const retry = await withTenant(db, ctx, (tx) => appendPoints(tx, entry));
      expect([first, retry]).toEqual([true, false]);
      await withTenant(db, ctx, (tx) =>
        appendPoints(tx, { ...entry, delta: -15, reason: 'spent', idempotencyKey: `spend:${tag}` }),
      );
      expect(await withTenant(db, ctx, (tx) => pointsBalance(tx, tenantA, people.ama.userId))).toBe(
        25,
      );
      await expect(
        withTenant(db, ctx, (tx) => appendPoints(tx, { ...entry, delta: 0, idempotencyKey: 'z' })),
      ).rejects.toThrow(RangeError);
    });

    it('is private to its business', async () => {
      const other = createTenantContext({ tenantId: tenantB, requestId: randomUUID() });
      expect(
        await withTenant(db, other, (tx) => pointsBalance(tx, tenantB, people.ama.userId)),
      ).toBe(0);
      const seen = await withTenant(db, other, (tx) => tx.pointsLedger.count());
      expect(seen).toBe(0);
    });
  });
});

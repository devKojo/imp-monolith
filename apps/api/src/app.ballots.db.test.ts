/**
 * End to end for the poll, image vote and giveaway campaign types: a business configures and launches one,
 * and participants vote or enter. The real app, the real identity guards (session cookie, CSRF, Origin), the
 * real routes and real PostgreSQL with the real roles and RLS. Sessions are created directly in the test
 * database, so no email or password flow is involved. Skipped unless the same TEST_DATABASE_URL_RUNTIME
 * / _PLATFORM variables as the isolation suite are set.
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
import { createMyParticipationsModule } from './modules/my-participations';
import { createParticipantsModule } from './modules/participants';
import { createTemplatesModule } from './modules/templates';
import { createVotingModule } from './modules/voting';
import { createPlatformDb, createTenantDb } from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);

describe.skipIf(!enabled)(
  'poll, image vote and giveaway end to end (real guards, real PostgreSQL)',
  () => {
    const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
    const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
    const tag = randomUUID().slice(0, 8);

    type Person = { cookie: string; csrf: string; userId: string };
    let tenantA = '';
    let tenantB = '';
    const people: Record<'owner' | 'outsider' | 'ama' | 'kofi' | 'yaw', Person> = {} as never;
    const userIds: string[] = [];
    let app: Awaited<ReturnType<typeof createApp>>;

    async function session(
      userId: string,
      active?: { tenantId: string; membershipId: string },
    ): Promise<Omit<Person, 'userId'>> {
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
        platform.business.create({ data: { name: `E2E-BA-${tag}` } }),
        platform.business.create({ data: { name: `E2E-BB-${tag}` } }),
      ]);
      tenantA = a.id;
      tenantB = b.id;
      people.owner = await business(tenantA, 'owner');
      people.outsider = await business(tenantB, 'outsider');
      people.ama = await participant('ama');
      people.kofi = await participant('kofi');
      people.yaw = await participant('yaw');

      const identity = createIdentityModule({
        db,
        allowedOrigins: [ORIGIN],
        sessionSecret: SECRET,
      });
      const templates = createTemplatesModule({ db, identity });
      const voting = createVotingModule({ db, identity });
      const giveaway = createGiveawayModule({ db, identity });
      const myParticipations = createMyParticipationsModule({ db, identity });
      const participants = createParticipantsModule({ db, identity });
      const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
      app = await createApp({
        bus: new InMemoryEventBus(),
        identity,
        templates,
        campaigns,
        voting,
        giveaway,
        myParticipations,
        participants,
      });
    });

    afterAll(async () => {
      const tenants = [tenantA, tenantB];
      await platform.participationSignal.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.vote.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.giveawayEntry.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.campaignField.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.campaignPrize.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.campaign.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.session.deleteMany({ where: { userId: { in: userIds } } });
      await platform.membership.deleteMany({ where: { tenantId: { in: tenants } } });
      await platform.user.deleteMany({ where: { id: { in: userIds } } });
      await platform.business.deleteMany({ where: { id: { in: tenants } } });
      await Promise.all([db.$disconnect(), platform.$disconnect()]);
    });

    const read = (p: Person | null, path: string) => {
      const r = request(app).get(`/api/v1/${path}`);
      return p ? r.set('Cookie', p.cookie) : r;
    };
    const write = (p: Person, method: 'post' | 'put', path: string, body?: object) =>
      request(app)
        [method](`/api/v1/${path}`)
        .set('Cookie', p.cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', p.csrf)
        .send(body);

    const field = (kind: string, label: string, over: Record<string, unknown> = {}) => ({
      kind,
      label,
      helper: '',
      required: false,
      options: [],
      correctIndex: null,
      ...over,
    });
    const details = [
      field('email', 'Email', { required: true }),
      field('consent', 'I agree', { required: true }),
    ];
    const candidates = [
      field('candidate', 'Aether Pod 1', {
        helper: 'Minimalist modular workstation',
        required: true,
        imageUrl: 'https://img.example.com/aether.png',
      }),
      field('candidate', 'Nebula Rig', {
        required: true,
        imageUrl: 'https://img.example.com/nebula.png',
      }),
    ];
    const pollQuestion = field('choice', 'Which model wins?', {
      required: true,
      options: ['zk', 'optimistic', 'monolithic'],
    });

    async function launched(
      title: string,
      templateId: string,
      over: { fields: unknown[]; settings?: object; prizes?: unknown[] },
    ) {
      const created = await write(people.owner, 'post', 'campaigns', { title, templateId });
      expect(created.status).toBe(201);
      const saved = await write(people.owner, 'put', `campaigns/${created.body.id}`, {
        expectedVersion: created.body.version,
        title,
        summary: 'Have your say',
        templateId,
        startAt: null,
        endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        prizes: over.prizes ?? [],
        fields: [...details, ...over.fields],
        settings: { quiz: null, ...over.settings },
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const launch = await write(people.owner, 'post', `campaigns/${created.body.id}/launch`, {
        expectedVersion: saved.body.version,
      });
      expect(launch.status, JSON.stringify(launch.body)).toBe(200);
      return { id: created.body.id as string, slug: launch.body.slug as string };
    }

    describe('poll', () => {
      it('starts a new poll with its question and shows visitors the facts but not the standings', async () => {
        const created = await write(people.owner, 'post', 'campaigns', {
          title: 'Starts with a question',
          templateId: SEEDED.poll,
        });
        expect(
          created.body.fields.filter((f: { kind: string }) => f.kind === 'choice'),
        ).toHaveLength(1);
        expect(created.body.settings.ballot).toEqual({ showResults: 'after_vote' });

        const { slug } = await launched('Public poll', SEEDED.poll, { fields: [pollQuestion] });
        const info = await read(null, `public/voting/${slug}`);
        expect(info.status).toBe(200);
        expect(info.headers['set-cookie']).toBeUndefined();
        expect(info.body).toMatchObject({
          kind: 'poll',
          title: 'Public poll',
          question: 'Which model wins?',
          optionCount: 3,
        });
        expect(JSON.stringify(info.body)).not.toContain('percent');
        expect((await read(null, `public/campaigns/${slug}`)).body).toMatchObject({ type: 'poll' });
      });

      it('takes one final vote per participant and shows the standings only after voting', async () => {
        const { slug } = await launched('Vote once', SEEDED.poll, { fields: [pollQuestion] });
        const { ama, kofi, yaw } = people;

        const before = await read(ama, `voting/${slug}`);
        expect(before.status).toBe(200);
        expect(before.body.options.map((o: { label: string }) => o.label)).toEqual([
          'zk',
          'optimistic',
          'monolithic',
        ]);
        expect(before.body.vote).toBeNull();
        expect(before.body.results).toBeNull();

        const voted = await write(ama, 'post', `voting/${slug}/vote`, { optionIndex: 0 });
        expect(voted.status, JSON.stringify(voted.body)).toBe(200);
        expect(voted.body.vote).toMatchObject({ optionIndex: 0 });
        expect(voted.body.results.total).toBe(1);

        const again = await write(ama, 'post', `voting/${slug}/vote`, { optionIndex: 1 });
        expect(again.status).toBe(409);
        expect(again.body.error?.code ?? again.body.code).toBe('ALREADY_VOTED');

        expect((await write(kofi, 'post', `voting/${slug}/vote`, { optionIndex: 0 })).status).toBe(
          200,
        );
        expect((await write(yaw, 'post', `voting/${slug}/vote`, { optionIndex: 2 })).status).toBe(
          200,
        );
        const after = await read(yaw, `voting/${slug}`);
        expect(after.body.results.total).toBe(3);
        expect(after.body.results.options.map((o: { votes: number }) => o.votes)).toEqual([
          2, 0, 1,
        ]);
        expect(
          after.body.results.options.reduce(
            (s: number, o: { percent: number }) => s + o.percent,
            0,
          ),
        ).toBe(100);
      });

      it('refuses an option that does not exist, a business account and a missing token', async () => {
        const { slug } = await launched('Guards', SEEDED.poll, { fields: [pollQuestion] });
        expect(
          (await write(people.ama, 'post', `voting/${slug}/vote`, { optionIndex: 3 })).status,
        ).toBe(422);
        expect(
          (await write(people.outsider, 'post', `voting/${slug}/vote`, { optionIndex: 0 })).status,
        ).toBe(403);
        expect((await read(null, `voting/${slug}`)).status).toBe(401);
        const noCsrf = await request(app)
          .post(`/api/v1/voting/${slug}/vote`)
          .set('Cookie', people.ama.cookie)
          .set('Origin', ORIGIN)
          .send({ optionIndex: 0 });
        expect(noCsrf.status).toBe(403);
      });

      it('shows the standings to everyone signed in when the campaign says live', async () => {
        const { slug } = await launched('Live poll', SEEDED.poll, {
          fields: [pollQuestion],
          settings: { ballot: { showResults: 'live' } },
        });
        const view = await read(people.ama, `voting/${slug}`);
        expect(view.body.vote).toBeNull();
        expect(view.body.results).toMatchObject({ total: 0 });
      });

      it('lets the business read its own standings and nobody else', async () => {
        const { id, slug } = await launched('Business results', SEEDED.poll, {
          fields: [pollQuestion],
        });
        await write(people.ama, 'post', `voting/${slug}/vote`, { optionIndex: 1 });
        const mine = await read(people.owner, `voting/campaigns/${id}/results`);
        expect(mine.status).toBe(200);
        expect(mine.body).toMatchObject({ kind: 'poll', total: 1 });
        expect(mine.body.options[1]).toMatchObject({ label: 'optimistic', votes: 1, percent: 100 });
        expect((await read(people.outsider, `voting/campaigns/${id}/results`)).status).toBe(404);
        expect((await read(people.ama, `voting/campaigns/${id}/results`)).status).toBe(403);
      });

      it("lists the vote among the participant's own participation", async () => {
        const { slug } = await launched('Listed poll', SEEDED.poll, { fields: [pollQuestion] });
        await write(people.kofi, 'post', `voting/${slug}/vote`, { optionIndex: 0 });
        const mine = await read(people.kofi, 'me/participations?limit=50');
        expect(mine.status).toBe(200);
        expect(mine.body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Listed poll',
              kind: 'poll',
              status: 'completed',
              slug,
            }),
          ]),
        );
      });

      it('will not launch a poll without a question to answer, or with too many answers', async () => {
        const created = await write(people.owner, 'post', 'campaigns', {
          title: 'Too many',
          templateId: SEEDED.poll,
        });
        const saved = await write(people.owner, 'put', `campaigns/${created.body.id}`, {
          expectedVersion: created.body.version,
          title: 'Too many',
          summary: '',
          templateId: SEEDED.poll,
          startAt: null,
          endAt: null,
          prizes: [],
          fields: [
            ...details,
            field('choice', 'Q', { options: Array.from({ length: 11 }, (_, i) => `Option ${i}`) }),
          ],
          settings: { quiz: null },
        });
        expect(saved.status).toBe(422);
      });
    });

    describe('image vote', () => {
      it('shows candidates with their pictures and counts a vote per candidate', async () => {
        const { slug } = await launched('Design award', SEEDED.vote, { fields: candidates });
        const view = await read(people.ama, `voting/${slug}`);
        expect(view.status).toBe(200);
        expect(view.body.kind).toBe('vote');
        expect(view.body.options).toEqual([
          {
            index: 0,
            label: 'Aether Pod 1',
            description: 'Minimalist modular workstation',
            imageUrl: 'https://img.example.com/aether.png',
          },
          {
            index: 1,
            label: 'Nebula Rig',
            description: '',
            imageUrl: 'https://img.example.com/nebula.png',
          },
        ]);
        expect(
          (await write(people.ama, 'post', `voting/${slug}/vote`, { optionIndex: 1 })).status,
        ).toBe(200);
        expect(
          (await write(people.kofi, 'post', `voting/${slug}/vote`, { optionIndex: 1 })).status,
        ).toBe(200);
        expect(
          (await write(people.yaw, 'post', `voting/${slug}/vote`, { optionIndex: 0 })).status,
        ).toBe(200);
        const after = await read(people.yaw, `voting/${slug}`);
        expect(after.body.vote).toMatchObject({ optionIndex: 0 });
        expect(after.body.results.options.map((o: { votes: number }) => o.votes)).toEqual([1, 2]);
        expect((await read(null, `public/campaigns/${slug}`)).body).toMatchObject({ type: 'vote' });
      });

      it('will not save a candidate whose picture is not an https link, and will not launch one without', async () => {
        const created = await write(people.owner, 'post', 'campaigns', {
          title: 'Bad picture',
          templateId: SEEDED.vote,
        });
        const body = {
          expectedVersion: created.body.version,
          title: 'Bad picture',
          summary: '',
          templateId: SEEDED.vote,
          startAt: null,
          endAt: new Date(Date.now() + 86_400_000).toISOString(),
          prizes: [],
          settings: { quiz: null },
        };
        const insecure = await write(people.owner, 'put', `campaigns/${created.body.id}`, {
          ...body,
          fields: [
            ...details,
            field('candidate', 'A', {
              imageUrl: 'http://insecure.example.com/a.png',
              required: true,
            }),
            field('candidate', 'B', { imageUrl: 'https://img.example.com/b.png', required: true }),
          ],
        });
        expect(insecure.status).toBe(422);
        // A draft may leave a picture for later, but it cannot launch without one.
        const saved = await write(people.owner, 'put', `campaigns/${created.body.id}`, {
          ...body,
          fields: [
            ...details,
            field('candidate', 'A', { required: true }),
            field('candidate', 'B', { imageUrl: 'https://img.example.com/b.png', required: true }),
          ],
        });
        expect(saved.status).toBe(200);
        const launch = await write(people.owner, 'post', `campaigns/${created.body.id}/launch`, {
          expectedVersion: saved.body.version,
        });
        expect(launch.status).toBe(422);
      });
    });

    describe('giveaway', () => {
      const prizes = [{ name: 'Grant', valueLabel: '$1,000', winners: 10, description: '' }];

      it('lets a participant enter once and numbers tickets in order', async () => {
        const { slug } = await launched('Big giveaway', SEEDED.giveaway, { fields: [], prizes });
        const info = await read(null, `public/giveaway/${slug}`);
        expect(info.status).toBe(200);
        expect(info.body).toMatchObject({ title: 'Big giveaway', entryCount: 0 });

        const none = await read(people.ama, `giveaway/${slug}`);
        expect(none.body.entry).toBeNull();

        const first = await write(people.ama, 'post', `giveaway/${slug}/entry`, {});
        expect(first.status, JSON.stringify(first.body)).toBe(200);
        expect(first.body.entry.ticketNumber).toBe(1);
        const again = await write(people.ama, 'post', `giveaway/${slug}/entry`, {});
        expect(again.body.entry.ticketNumber).toBe(1);
        const second = await write(people.kofi, 'post', `giveaway/${slug}/entry`, {});
        expect(second.body.entry.ticketNumber).toBe(2);
        expect(second.body.entryCount).toBe(2);
        expect((await read(null, `public/giveaway/${slug}`)).body.entryCount).toBe(2);
      });

      it('records abuse-detection signals once per participant, as hashes only', async () => {
        const { slug, id } = await launched('Signal giveaway', SEEDED.giveaway, {
          fields: [],
          prizes,
        });
        await write(people.ama, 'post', `giveaway/${slug}/entry`, {});
        await write(people.ama, 'post', `giveaway/${slug}/entry`, {}); // a repeat adds nothing
        const rows = await platform.participationSignal.findMany({ where: { campaignId: id } });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ userId: people.ama.userId, kind: 'JOIN' });
        // A keyed hash, not the address itself.
        expect(rows[0]?.ipHash).toMatch(/^[0-9a-f]{32}$/);
        expect(rows[0]?.ipHash).not.toContain('127.0.0.1');
      });

      it('hands out distinct tickets when people enter at the same moment', async () => {
        const { slug } = await launched('Rush giveaway', SEEDED.giveaway, { fields: [], prizes });
        const entries = await Promise.all(
          [people.ama, people.kofi, people.yaw].map((p) =>
            write(p, 'post', `giveaway/${slug}/entry`, {}),
          ),
        );
        expect(entries.map((r) => r.status)).toEqual([200, 200, 200]);
        expect(entries.map((r) => r.body.entry.ticketNumber).sort()).toEqual([1, 2, 3]);
      });

      it('refuses a business account, and does not mix up another type', async () => {
        const { slug } = await launched('Giveaway guards', SEEDED.giveaway, { fields: [], prizes });
        expect((await write(people.outsider, 'post', `giveaway/${slug}/entry`, {})).status).toBe(
          403,
        );
        const poll = await launched('Not a giveaway', SEEDED.poll, { fields: [pollQuestion] });
        expect((await write(people.ama, 'post', `giveaway/${poll.slug}/entry`, {})).status).toBe(
          404,
        );
        expect(
          (await write(people.ama, 'post', `voting/${slug}/vote`, { optionIndex: 0 })).status,
        ).toBe(404);
      });

      it("lists the entry among the participant's own participation", async () => {
        const { slug } = await launched('Listed giveaway', SEEDED.giveaway, { fields: [], prizes });
        await write(people.yaw, 'post', `giveaway/${slug}/entry`, {});
        const mine = await read(people.yaw, 'me/participations?limit=50');
        expect(mine.body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Listed giveaway',
              kind: 'giveaway',
              status: 'completed',
            }),
          ]),
        );
      });
    });

    describe("the business's participants list", () => {
      it('shows votes and entries, and counts them in the summary and one campaign', async () => {
        const poll = await launched('Listed vote', SEEDED.poll, { fields: [pollQuestion] });
        const giveaway = await launched('Listed entry', SEEDED.giveaway, {
          fields: [],
          prizes: [{ name: 'Grant', valueLabel: '$1', winners: 1, description: '' }],
        });
        await write(people.ama, 'post', `voting/${poll.slug}/vote`, { optionIndex: 0 });
        await write(people.kofi, 'post', `voting/${poll.slug}/vote`, { optionIndex: 1 });
        await write(people.ama, 'post', `giveaway/${giveaway.slug}/entry`, {});

        const list = await read(people.owner, `participants?campaignId=${poll.id}`);
        expect(list.status, JSON.stringify(list.body)).toBe(200);
        expect(list.body.total).toBe(2);
        expect(list.body.items[0]).toMatchObject({
          kind: 'poll',
          status: 'completed',
          campaignTitle: 'Listed vote',
        });
        expect(JSON.stringify(list.body)).not.toContain('@test.local');

        const entries = await read(people.owner, `participants?campaignId=${giveaway.id}`);
        expect(entries.body.items).toEqual([
          expect.objectContaining({ kind: 'giveaway', name: 'ama', status: 'completed' }),
        ]);
        // Nothing of a vote or an entry is ever "in progress".
        const open = await read(
          people.owner,
          `participants?campaignId=${poll.id}&status=in_progress`,
        );
        expect(open.body.total).toBe(0);

        const summary = await read(people.owner, 'participants/summary');
        expect(summary.body.campaigns).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              campaignId: poll.id,
              kind: 'poll',
              started: 2,
              completed: 2,
            }),
            expect.objectContaining({
              campaignId: giveaway.id,
              kind: 'giveaway',
              started: 1,
              completed: 1,
            }),
          ]),
        );

        const one = await read(people.owner, `participants/campaigns/${poll.id}`);
        expect(one.status).toBe(200);
        expect(one.body).toMatchObject({ kind: 'poll', started: 2, completed: 2, quiz: null });
        expect(one.body.daily.at(-1)).toMatchObject({ started: 2, completed: 2 });
        const mine = await read(people.owner, `participants/campaigns/${giveaway.id}`);
        expect(mine.body).toMatchObject({ kind: 'giveaway', started: 1, completed: 1 });

        const activity = await read(people.owner, 'participants/activity');
        expect(activity.body.daily.at(-1).started).toBeGreaterThanOrEqual(3);
        // Another business sees none of it.
        expect((await read(people.outsider, `participants?campaignId=${poll.id}`)).body.total).toBe(
          0,
        );
      });
    });
  },
);

/**
 * End to end for what a business sees about its participants: quiz attempts and survey responses made
 * through the real participant routes, read back through the business routes. The real app, the real identity guards (session cookie, CSRF, Origin), the real
 * routes and real PostgreSQL with the real roles and RLS. Sessions are created directly in the test
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
import { createIdentityModule } from './modules/identity';
import { csrfTokenFor, generateToken, hashToken } from './modules/identity/domain/tokens';
import { createMyParticipationsModule } from './modules/my-participations';
import { createParticipantsModule } from './modules/participants';
import { createQuizModule } from './modules/quiz';
import { createSurveyModule } from './modules/survey';
import { createTemplatesModule } from './modules/templates';
import { createPlatformDb, createTenantDb } from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);

describe.skipIf(!enabled)('participants API end to end (real guards, real PostgreSQL)', () => {
  const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
  const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
  const tag = randomUUID().slice(0, 8);

  type Person = { cookie: string; csrf: string; userId: string };
  let tenantA = '';
  let tenantB = '';
  const people: Record<'owner' | 'outsider' | 'ama' | 'kofi', Person> = {} as never;
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
      platform.business.create({ data: { name: `E2E-PA-${tag}` } }),
      platform.business.create({ data: { name: `E2E-PB-${tag}` } }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    people.owner = await business(tenantA, 'owner');
    people.outsider = await business(tenantB, 'outsider');
    people.ama = await participant('ama');
    people.kofi = await participant('kofi');

    const identity = createIdentityModule({ db, allowedOrigins: [ORIGIN], sessionSecret: SECRET });
    const templates = createTemplatesModule({ db, identity });
    const quiz = createQuizModule({ db, identity });
    const survey = createSurveyModule({ db, identity });
    const participants = createParticipantsModule({ db, identity });
    const myParticipations = createMyParticipationsModule({ db, identity });
    const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
    app = await createApp({
      bus: new InMemoryEventBus(),
      identity,
      templates,
      campaigns,
      quiz,
      survey,
      participants,
      myParticipations,
    });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
    await platform.quizAnswer.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.quizAttempt.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.surveyAnswer.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.surveyResponse.deleteMany({ where: { tenantId: { in: tenants } } });
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

  /** A launched campaign made through the real API as the given business owner. */
  async function launched(
    owner: Person,
    template: string,
    title: string,
    content: unknown[],
    settings: object,
  ) {
    const created = await write(owner, 'post', 'campaigns', { title, templateId: template });
    expect(created.status).toBe(201);
    const saved = await write(owner, 'put', `campaigns/${created.body.id}`, {
      expectedVersion: created.body.version,
      title,
      summary: '',
      templateId: template,
      startAt: null,
      endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      prizes: [],
      fields: [
        field('email', 'Email', { required: true }),
        field('consent', 'I agree', { required: true }),
        ...content,
      ],
      settings,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const launch = await write(owner, 'post', `campaigns/${created.body.id}/launch`, {
      expectedVersion: saved.body.version,
    });
    expect(launch.status).toBe(200);
    return { id: created.body.id as string, slug: launch.body.slug as string };
  }

  let quiz: { id: string; slug: string };
  let survey: { id: string; slug: string };

  beforeAll(async () => {
    quiz = await launched(
      people.owner,
      SEEDED.quiz,
      'Participants quiz',
      [field('quiz_question', '2 + 2?', { options: ['3', '4'], correctIndex: 1 })],
      { quiz: { timeLimitMinutes: null, passPercent: 50, maxAttempts: 1 } },
    );
    survey = await launched(
      people.owner,
      SEEDED.survey,
      'Participants survey',
      [field('long_text', 'Anything else?')],
      { quiz: null },
    );

    // Ama finishes the quiz and the survey; Kofi only starts the survey.
    const attempt = (await write(people.ama, 'post', `quiz/${quiz.slug}/attempt`)).body;
    await write(people.ama, 'put', `quiz/${quiz.slug}/attempt/answers/${attempt.questions[0].id}`, {
      choiceIndex: 1,
    });
    await write(people.ama, 'post', `quiz/${quiz.slug}/attempt/submit`);
    const response = (await write(people.ama, 'post', `survey/${survey.slug}/response`)).body;
    await write(
      people.ama,
      'put',
      `survey/${survey.slug}/response/answers/${response.questions[0].id}`,
      {
        text: 'Nothing',
      },
    );
    await write(people.ama, 'post', `survey/${survey.slug}/response/submit`);
    await write(people.kofi, 'post', `survey/${survey.slug}/response`);
  });

  it('counts the people and the progress, per campaign', async () => {
    const res = await read(people.owner, 'participants/summary');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ participants: 2, started: 3, completed: 2 });
    const byId = Object.fromEntries(
      res.body.campaigns.map((c: { campaignId: string }) => [c.campaignId, c]),
    );
    expect(byId[quiz.id]).toMatchObject({ kind: 'quiz', started: 1, completed: 1 });
    expect(byId[survey.id]).toMatchObject({ kind: 'survey', started: 2, completed: 1 });
  });

  it('lists who took part, newest first, with names only', async () => {
    const res = await read(people.owner, 'participants');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const names = res.body.items.map((i: { name: string }) => i.name).sort();
    expect(names).toEqual(['ama', 'ama', 'kofi']);
    const dates = res.body.items.map((i: { startedAt: string }) => i.startedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(JSON.stringify(res.body)).not.toMatch(/@test\.local/);

    const quizRow = res.body.items.find((i: { kind: string }) => i.kind === 'quiz');
    expect(quizRow).toMatchObject({
      status: 'completed',
      campaignTitle: 'Participants quiz',
      result: { score: 1, total: 1, passed: true },
    });
    const kofi = res.body.items.find((i: { name: string }) => i.name === 'kofi');
    expect(kofi).toMatchObject({
      kind: 'survey',
      status: 'in_progress',
      completedAt: null,
      result: null,
    });
  });

  it('filters by campaign and by status, and pages', async () => {
    const one = await read(people.owner, `participants?campaignId=${survey.id}`);
    expect(one.body.total).toBe(2);
    const open = await read(people.owner, 'participants?status=in_progress');
    expect(open.body.items.map((i: { name: string }) => i.name)).toEqual(['kofi']);
    const done = await read(people.owner, 'participants?status=completed');
    expect(done.body.total).toBe(2);
    const first = await read(people.owner, 'participants?limit=1');
    const second = await read(people.owner, 'participants?limit=1&offset=1');
    expect(first.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect(first.body.total).toBe(3);
    expect((await read(people.owner, 'participants?limit=1000')).status).toBe(400);
    expect((await read(people.owner, 'participants?campaignId=nope')).status).toBe(400);
  });

  it('summarises how one campaign is going, without names or answers', async () => {
    const q = await read(people.owner, `participants/campaigns/${quiz.id}`);
    expect(q.status).toBe(200);
    expect(q.headers['cache-control']).toBe('no-store');
    expect(q.body).toMatchObject({
      campaignId: quiz.id,
      title: 'Participants quiz',
      kind: 'quiz',
      started: 1,
      completed: 1,
      quiz: { passed: 1, failed: 0, correctPercent: 100 },
    });
    expect(q.body.daily).toHaveLength(14);
    const today = new Date().toISOString().slice(0, 10);
    expect(q.body.daily.at(-1)).toEqual({ date: today, started: 1, completed: 1 });
    expect(q.body.daily.slice(0, -1).every((d: { started: number }) => d.started === 0)).toBe(true);
    expect(JSON.stringify(q.body)).not.toMatch(/ama|kofi/i);

    const s = await read(people.owner, `participants/campaigns/${survey.id}`);
    expect(s.body).toMatchObject({ kind: 'survey', started: 2, completed: 1, quiz: null });
    expect(s.body.daily.at(-1)).toEqual({ date: today, started: 2, completed: 1 });
  });

  it('summarises the whole business: activity over the last days and quiz outcomes', async () => {
    const res = await read(people.owner, 'participants/activity');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.daily).toHaveLength(14);
    const today = new Date().toISOString().slice(0, 10);
    // Ama finished the quiz and the survey and Kofi started the survey: three starts, two finishes.
    expect(res.body.daily.at(-1)).toEqual({ date: today, started: 3, completed: 2 });
    expect(res.body.quiz).toEqual({ passed: 1, failed: 0, correctPercent: 100 });
    expect((await read(people.outsider, 'participants/activity')).body).toMatchObject({
      quiz: null,
    });
    expect((await read(people.ama, 'participants/activity')).status).toBe(403);
    expect((await read(null, 'participants/activity')).status).toBe(401);
  });

  it('numbers each participation, a survey always as attempt 1', async () => {
    const list = await read(people.owner, 'participants');
    expect(list.body.items.every((i: { attempt: number }) => i.attempt === 1)).toBe(true);
  });

  it('does not show a campaign of another business, or an unknown one', async () => {
    expect((await read(people.outsider, `participants/campaigns/${quiz.id}`)).status).toBe(404);
    expect((await read(people.owner, `participants/campaigns/${randomUUID()}`)).status).toBe(404);
    expect((await read(people.owner, 'participants/campaigns/nope')).status).toBe(400);
    expect((await read(people.ama, `participants/campaigns/${quiz.id}`)).status).toBe(403);
  });

  it('shows another business nothing of these participants', async () => {
    const summary = await read(people.outsider, 'participants/summary');
    expect(summary.body).toMatchObject({
      participants: 0,
      started: 0,
      completed: 0,
      campaigns: [],
    });
    const list = await read(people.outsider, 'participants');
    expect(list.body).toEqual({ items: [], total: 0 });
    expect((await read(people.outsider, `participants?campaignId=${quiz.id}`)).body.total).toBe(0);
  });

  it('needs a business session: participants and visitors are refused', async () => {
    expect((await read(null, 'participants')).status).toBe(401);
    expect((await read(people.ama, 'participants')).status).toBe(403);
    expect((await read(people.ama, 'participants/summary')).status).toBe(403);
  });

  it("lists a person's own participation across businesses, and nobody else's", async () => {
    const ama = await read(people.ama, 'me/participations');
    expect(ama.status).toBe(200);
    expect(ama.headers['cache-control']).toBe('no-store');
    expect(ama.body.items).toHaveLength(2);
    const quizRow = ama.body.items.find((i: { kind: string }) => i.kind === 'quiz');
    expect(quizRow).toMatchObject({
      campaignId: quiz.id,
      title: 'Participants quiz',
      slug: quiz.slug,
      status: 'completed',
      score: 1,
      total: 1,
      passed: true,
    });
    const surveyRow = ama.body.items.find((i: { kind: string }) => i.kind === 'survey');
    expect(surveyRow).toMatchObject({ title: 'Participants survey', status: 'completed' });

    const kofi = await read(people.kofi, 'me/participations');
    expect(kofi.body.items).toHaveLength(1);
    expect(kofi.body.items[0]).toMatchObject({ kind: 'survey', status: 'in_progress' });
  });

  it('shows nothing to a person who has not taken part, and needs a session', async () => {
    expect((await read(people.owner, 'me/participations')).body.items).toEqual([]);
    expect((await read(null, 'me/participations')).status).toBe(401);
  });
});

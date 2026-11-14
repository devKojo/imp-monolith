/**
 * End to end for taking a quiz: a business writes the questions on a quiz campaign and launches it, and a
 * participant takes it. The real app, the real identity guards (session cookie, CSRF, Origin), the real
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
import { createQuizModule } from './modules/quiz';
import { createTemplatesModule } from './modules/templates';
import { createPlatformDb, createTenantDb } from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);

describe.skipIf(!enabled)('quiz API end to end (real guards, real PostgreSQL)', () => {
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
      platform.business.create({ data: { name: `E2E-QA-${tag}` } }),
      platform.business.create({ data: { name: `E2E-QB-${tag}` } }),
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
    const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
    app = await createApp({ bus: new InMemoryEventBus(), identity, templates, campaigns, quiz });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
    await platform.quizAnswer.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.quizAttempt.deleteMany({ where: { tenantId: { in: tenants } } });
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

  /** A draft quiz campaign made through the real API, with its type's starting fields. */
  async function draftQuizCampaign(title: string) {
    const created = await write(people.owner, 'post', 'campaigns', {
      title,
      templateId: SEEDED.quiz,
    });
    expect(created.status).toBe(201);
    return { id: created.body.id as string, version: created.body.version as number };
  }

  /** Writes the questions and settings on the campaign, as the builder does. */
  async function saveQuiz(
    c: { id: string; version: number },
    over: { timeLimitMinutes?: number | null; passPercent?: number; questions?: unknown[] } = {},
  ) {
    const res = await write(people.owner, 'put', `campaigns/${c.id}`, {
      expectedVersion: c.version,
      title: 'Quiz',
      summary: 'Test yourself',
      templateId: SEEDED.quiz,
      startAt: null,
      endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      prizes: [],
      fields: [
        field('email', 'Email', { required: true }),
        field('consent', 'I agree', { required: true }),
        ...(over.questions ?? questions),
      ],
      settings: {
        quiz: {
          timeLimitMinutes: over.timeLimitMinutes ?? null,
          passPercent: over.passPercent ?? 60,
        },
      },
    });
    expect(res.status).toBe(200);
    return { id: c.id, version: res.body.version as number };
  }

  async function launched(title: string, over: Parameters<typeof saveQuiz>[1] = {}) {
    const saved = await saveQuiz(await draftQuizCampaign(title), over);
    const launch = await write(people.owner, 'post', `campaigns/${saved.id}/launch`, {
      expectedVersion: saved.version,
    });
    expect(launch.status).toBe(200);
    return { id: saved.id, slug: launch.body.slug as string };
  }

  it('will not launch a quiz that has no questions, and launches it once it has some', async () => {
    const draft = await draftQuizCampaign('Empty quiz');
    const saved = await saveQuiz(draft, { questions: [] });
    const refused = await write(people.owner, 'post', `campaigns/${saved.id}/launch`, {
      expectedVersion: saved.version,
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.failed).toEqual(['content']);
    const again = await saveQuiz(saved);
    expect(
      (
        await write(people.owner, 'post', `campaigns/${again.id}/launch`, {
          expectedVersion: again.version,
        })
      ).status,
    ).toBe(200);
  });

  it('shows visitors the rules without any question, and nothing for a campaign that is not running', async () => {
    const draft = await saveQuiz(await draftQuizCampaign('Not yet running'));
    expect(draft.id).toBeTruthy();
    const { slug } = await launched('Public rules', { timeLimitMinutes: 10, passPercent: 80 });
    const info = await read(null, `public/quiz/${slug}`);
    expect(info.status).toBe(200);
    expect(info.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
    expect(info.headers['set-cookie']).toBeUndefined();
    expect(info.body).toMatchObject({
      title: 'Quiz',
      businessName: `E2E-QA-${tag}`,
      questionCount: 3,
      timeLimitMinutes: 10,
      passPercent: 80,
    });
    expect(JSON.stringify(info.body)).not.toContain('Capital of Ghana');
    expect((await read(null, `public/quiz/no-such-quiz-aaaaaa`)).status).toBe(404);

    // The campaign page's own facts come from the public campaign endpoint.
    const page = await read(null, `public/campaigns/${slug}`);
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ slug, type: 'quiz' });
    expect((await read(null, `public/campaigns/not-yet-running-aaaaaa`)).status).toBe(404);
  });

  it('lets a participant take the quiz: no correct answers sent, scored by the server', async () => {
    const { slug } = await launched('Take it');
    const ama = people.ama;

    const started = await write(ama, 'post', `quiz/${slug}/attempt`);
    expect(started.status).toBe(200);
    // The questions are the ones written on the campaign, in order.
    expect(started.body.questions.map((q: { prompt: string }) => q.prompt)).toEqual([
      'Capital of Ghana?',
      '2 + 2?',
      'Largest planet?',
    ]);
    expect(JSON.stringify(started.body)).not.toMatch(/correct/i);
    expect(started.body).toMatchObject({ answers: {}, result: null, expiresAt: null });

    // Starting again returns the same attempt.
    const again = await write(ama, 'post', `quiz/${slug}/attempt`);
    expect(again.body.id).toBe(started.body.id);

    const [q1, q2, q3] = started.body.questions as Array<{ id: string; options: string[] }>;
    const answer = (qid: string, choiceIndex: number) =>
      write(ama, 'put', `quiz/${slug}/attempt/answers/${qid}`, { choiceIndex });
    expect((await answer(q1!.id, 0)).status).toBe(204);
    expect((await answer(q2!.id, 0)).status).toBe(204);
    expect((await answer(q2!.id, 1)).status).toBe(204); // changing an answer is allowed
    expect((await answer(q3!.id, 5)).status).toBe(422); // not one of the options
    expect((await answer(randomUUID(), 0)).status).toBe(422); // not one of the questions

    const resumed = await read(ama, `quiz/${slug}/attempt`);
    expect(resumed.body.answers).toEqual({ [q1!.id]: 0, [q2!.id]: 1 });

    const done = await write(ama, 'post', `quiz/${slug}/attempt/submit`);
    expect(done.status).toBe(200);
    expect(done.body.result).toEqual({ score: 2, total: 3, passed: true, passPercent: 60 });
    expect(done.body.submittedAt).not.toBeNull();

    // Finished: the answers are fixed, and submitting again changes nothing.
    expect((await answer(q3!.id, 1)).status).toBe(409);
    const twice = await write(ama, 'post', `quiz/${slug}/attempt/submit`);
    expect(twice.body.result).toEqual(done.body.result);
  });

  it('keeps each participant to their own attempt', async () => {
    const { slug } = await launched('Two people');
    const a = (await write(people.ama, 'post', `quiz/${slug}/attempt`)).body;
    const k = (await write(people.kofi, 'post', `quiz/${slug}/attempt`)).body;
    expect(a.id).not.toBe(k.id);
    await write(people.ama, 'put', `quiz/${slug}/attempt/answers/${a.questions[0].id}`, {
      choiceIndex: 0,
    });
    expect((await read(people.kofi, `quiz/${slug}/attempt`)).body.answers).toEqual({});
  });

  it('is for participant accounts with a session, and only for running quizzes', async () => {
    const { slug } = await launched('Who can enter');
    expect((await write(people.owner, 'post', `quiz/${slug}/attempt`)).status).toBe(403);
    expect((await write(people.outsider, 'post', `quiz/${slug}/attempt`)).status).toBe(403);
    expect((await read(null, `quiz/${slug}/attempt`)).status).toBe(401);
    expect((await read(people.kofi, `quiz/${slug}/attempt`)).body.error.code).toBe('NO_ATTEMPT');
    expect((await write(people.kofi, 'post', `quiz/not-a-real-quiz-abc123/attempt`)).status).toBe(
      404,
    );

    const draft = await saveQuiz(await draftQuizCampaign('Never launched'));
    expect(draft.id).toBeTruthy();
    expect((await write(people.kofi, 'post', `quiz/never-launched-aaaaaa/attempt`)).status).toBe(
      404,
    );
  });

  it('closes a timed attempt when its time is up and scores what was answered', async () => {
    const { slug } = await launched('Against the clock', { timeLimitMinutes: 5 });

    const ama = people.ama;
    const started = (await write(ama, 'post', `quiz/${slug}/attempt`)).body;
    expect(new Date(started.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await write(ama, 'put', `quiz/${slug}/attempt/answers/${started.questions[0].id}`, {
      choiceIndex: 0,
    });

    // Time runs out: move the deadline into the past, as if the participant had walked away.
    await platform.quizAttempt.updateMany({
      where: { id: started.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const after = await read(ama, `quiz/${slug}/attempt`);
    expect(after.body.result).toEqual({ score: 1, total: 3, passed: false, passPercent: 60 });
    expect(
      (
        await write(ama, 'put', `quiz/${slug}/attempt/answers/${started.questions[1].id}`, {
          choiceIndex: 1,
        })
      ).status,
    ).toBe(409);
  });
});

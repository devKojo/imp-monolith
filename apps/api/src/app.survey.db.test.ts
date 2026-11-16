/**
 * End to end for taking a survey: a business writes the questions on a survey campaign and launches it, and
 * a participant answers it. The real app, the real identity guards (session cookie, CSRF, Origin), the real
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
import { createSurveyModule } from './modules/survey';
import { createTemplatesModule } from './modules/templates';
import { createPlatformDb, createTenantDb } from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);

describe.skipIf(!enabled)('survey API end to end (real guards, real PostgreSQL)', () => {
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
      platform.business.create({ data: { name: `E2E-SA-${tag}` } }),
      platform.business.create({ data: { name: `E2E-SB-${tag}` } }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    people.owner = await business(tenantA, 'owner');
    people.outsider = await business(tenantB, 'outsider');
    people.ama = await participant('ama');
    people.kofi = await participant('kofi');

    const identity = createIdentityModule({ db, allowedOrigins: [ORIGIN], sessionSecret: SECRET });
    const templates = createTemplatesModule({ db, identity });
    const survey = createSurveyModule({ db, identity });
    const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
    app = await createApp({ bus: new InMemoryEventBus(), identity, templates, campaigns, survey });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
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
  const questions = [
    field('choice', 'How did you hear about us?', {
      required: true,
      options: ['Friend', 'Radio', 'Online'],
    }),
    field('likert', 'The service was easy to use.', { required: true }),
    field('long_text', 'Anything else to tell us?'),
  ];

  async function launched(title: string, over: { questions?: unknown[] } = {}) {
    const created = await write(people.owner, 'post', 'campaigns', {
      title,
      templateId: SEEDED.survey,
    });
    expect(created.status).toBe(201);
    const saved = await write(people.owner, 'put', `campaigns/${created.body.id}`, {
      expectedVersion: created.body.version,
      title,
      summary: 'Tell us what you think',
      templateId: SEEDED.survey,
      startAt: null,
      endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      prizes: [],
      fields: [
        field('email', 'Email', { required: true }),
        field('consent', 'I agree', { required: true }),
        ...(over.questions ?? questions),
      ],
      settings: { quiz: null },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const launch = await write(people.owner, 'post', `campaigns/${created.body.id}/launch`, {
      expectedVersion: saved.body.version,
    });
    expect(launch.status).toBe(200);
    return { id: created.body.id as string, slug: launch.body.slug as string };
  }

  it('shows visitors the facts without any question', async () => {
    const { slug } = await launched('Public facts');
    const info = await read(null, `public/survey/${slug}`);
    expect(info.status).toBe(200);
    expect(info.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
    expect(info.headers['set-cookie']).toBeUndefined();
    expect(info.body).toMatchObject({
      title: 'Public facts',
      businessName: `E2E-SA-${tag}`,
      questionCount: 3,
      requiredCount: 2,
      estimatedMinutes: 2,
    });
    expect(JSON.stringify(info.body)).not.toContain('How did you hear');
    expect((await read(null, 'public/survey/no-such-survey-aaaaaa')).status).toBe(404);
    expect((await read(null, `public/campaigns/${slug}`)).body).toMatchObject({ type: 'survey' });
  });

  it('lets a participant answer, change answers, clear an optional one, and submit', async () => {
    const { slug } = await launched('Take it');
    const ama = people.ama;

    const started = await write(ama, 'post', `survey/${slug}/response`);
    expect(started.status).toBe(200);
    expect(started.body.questions.map((q: { prompt: string }) => q.prompt)).toEqual([
      'How did you hear about us?',
      'The service was easy to use.',
      'Anything else to tell us?',
    ]);
    expect(started.body).toMatchObject({ answers: {}, submittedAt: null });
    expect((await write(ama, 'post', `survey/${slug}/response`)).body.id).toBe(started.body.id);

    const [q1, q2, q3] = started.body.questions as Array<{ id: string }>;
    const put = (qid: string, body: object) =>
      write(ama, 'put', `survey/${slug}/response/answers/${qid}`, body);
    expect((await put(q1!.id, { choiceIndex: 1 })).status).toBe(204);
    expect((await put(q1!.id, { choiceIndex: 2 })).status).toBe(204); // changing is allowed
    expect((await put(q1!.id, { choiceIndex: 3 })).status).toBe(422); // not an option
    expect((await put(q1!.id, { text: 'Radio' })).status).toBe(422); // wrong shape for a choice
    expect((await put(q2!.id, { choiceIndex: 5 })).status).toBe(422); // a rating has five points
    expect((await put(q3!.id, { choiceIndex: 0 })).status).toBe(422);
    expect((await put(randomUUID(), { choiceIndex: 0 })).status).toBe(422);
    expect((await put(q3!.id, { text: '  Great job  ' })).status).toBe(204);

    // A required question is still open, so it cannot be submitted yet.
    const early = await write(ama, 'post', `survey/${slug}/response/submit`);
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('ANSWERS_REQUIRED');

    expect((await put(q2!.id, { choiceIndex: 4 })).status).toBe(204);
    expect((await put(q3!.id, { text: '   ' })).status).toBe(204); // clears the optional answer
    expect((await read(ama, `survey/${slug}/response`)).body.answers).toEqual({
      [q1!.id]: { choiceIndex: 2 },
      [q2!.id]: { choiceIndex: 4 },
    });

    const done = await write(ama, 'post', `survey/${slug}/response/submit`);
    expect(done.status).toBe(200);
    expect(done.body.submittedAt).not.toBeNull();

    // Submitted: the answers are fixed, and submitting again changes nothing.
    expect((await put(q1!.id, { choiceIndex: 0 })).status).toBe(409);
    expect((await write(ama, 'post', `survey/${slug}/response/submit`)).body.submittedAt).toBe(
      done.body.submittedAt,
    );
  });

  it('keeps each participant to their own response', async () => {
    const { slug } = await launched('Two people');
    const a = (await write(people.ama, 'post', `survey/${slug}/response`)).body;
    const k = (await write(people.kofi, 'post', `survey/${slug}/response`)).body;
    expect(a.id).not.toBe(k.id);
    await write(people.ama, 'put', `survey/${slug}/response/answers/${a.questions[0].id}`, {
      choiceIndex: 0,
    });
    expect((await read(people.kofi, `survey/${slug}/response`)).body.answers).toEqual({});
  });

  it('is for participant accounts with a session, and only for running surveys', async () => {
    const { slug } = await launched('Who can enter');
    expect((await write(people.owner, 'post', `survey/${slug}/response`)).status).toBe(403);
    expect((await write(people.outsider, 'post', `survey/${slug}/response`)).status).toBe(403);
    expect((await read(null, `survey/${slug}/response`)).status).toBe(401);
    expect((await read(people.kofi, `survey/${slug}/response`)).body.error.code).toBe(
      'NO_RESPONSE',
    );
    expect(
      (await write(people.kofi, 'post', 'survey/not-a-real-survey-abc123/response')).status,
    ).toBe(404);
  });
});

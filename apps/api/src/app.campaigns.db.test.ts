/**
 * End to end for campaigns and the built-in campaign types: the real app, the real identity guards
 * (session cookie, CSRF, Origin), the real routes and real PostgreSQL with the real roles and RLS.
 * Sessions are created directly in the test database, so no email or password flow is involved.
 * Skipped unless the same TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as the isolation suite are set.
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
import { createTemplatesModule } from './modules/templates';
import { createPlatformDb, createTenantDb } from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);

describe.skipIf(!enabled)('campaigns API end to end (real guards, real PostgreSQL)', () => {
  const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
  const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
  const tag = randomUUID().slice(0, 8);

  type Person = { cookie: string; csrf: string };
  let tenantA = '';
  let tenantB = '';
  const people: Record<'owner' | 'operator' | 'analyst' | 'outsider' | 'participant', Person> =
    {} as never;
  const userIds: string[] = [];
  let app: Awaited<ReturnType<typeof createApp>>;

  async function person(
    tenantId: string | null,
    role: 'BUSINESS_OWNER' | 'CAMPAIGN_OPERATOR' | 'ANALYST' | null,
    name: string,
  ): Promise<Person> {
    const user = await platform.user.create({
      data: {
        email: `${name}-${tag}@test.local`,
        name,
        emailVerifiedAt: new Date(),
        ...(role ? {} : { accountType: 'PARTICIPANT' as const }),
      },
    });
    userIds.push(user.id);
    const membership =
      tenantId && role
        ? await platform.membership.create({ data: { tenantId, userId: user.id, role } })
        : null;
    const token = generateToken();
    const tokenHash = hashToken(token);
    await platform.session.create({
      data: {
        tokenHash,
        userId: user.id,
        activeTenantId: membership ? tenantId : null,
        activeMembershipId: membership?.id ?? null,
        expiresAt: new Date(Date.now() + 8 * 3600_000),
      },
    });
    return { cookie: `__Host-sid=${token}`, csrf: csrfTokenFor(SECRET, tokenHash) };
  }

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      platform.business.create({ data: { name: `E2E-CA-${tag}` } }),
      platform.business.create({ data: { name: `E2E-CB-${tag}` } }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    people.owner = await person(tenantA, 'BUSINESS_OWNER', 'owner');
    people.operator = await person(tenantA, 'CAMPAIGN_OPERATOR', 'operator');
    people.analyst = await person(tenantA, 'ANALYST', 'analyst');
    people.outsider = await person(tenantB, 'BUSINESS_OWNER', 'outsider');
    people.participant = await person(null, null, 'participant');

    const identity = createIdentityModule({ db, allowedOrigins: [ORIGIN], sessionSecret: SECRET });
    const templates = createTemplatesModule({ db, identity });
    const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
    app = await createApp({ bus: new InMemoryEventBus(), identity, templates, campaigns });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
    await platform.campaignField.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.campaignPrize.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.campaign.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.session.deleteMany({ where: { userId: { in: userIds } } });
    await platform.membership.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.user.deleteMany({ where: { id: { in: userIds } } });
    await platform.business.deleteMany({ where: { id: { in: tenants } } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  const read = (p: Person, path: string) =>
    request(app).get(`/api/v1/${path}`).set('Cookie', p.cookie);
  const write = (p: Person, method: 'post' | 'put' | 'delete', path: string, body?: object) =>
    request(app)
      [method](`/api/v1/${path}`)
      .set('Cookie', p.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', p.csrf)
      .send(body);

  const field = (kind: string, over: Record<string, unknown> = {}) => ({
    kind,
    label: kind,
    helper: '',
    required: false,
    options: [],
    correctIndex: null,
    ...over,
  });
  const details = () => [
    field('email', { label: 'Email', required: true }),
    field('consent', { label: 'I agree', required: true }),
  ];
  const content = (templateId: string, over: Record<string, unknown> = {}) => ({
    title: 'Black Friday Giveaway',
    summary: 'Win big',
    templateId,
    startAt: null,
    endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    prizes: [
      { name: 'Grand prize', valueLabel: 'GH₵ 5,000', winners: 1, description: 'The big one' },
      { name: 'Runner-up', valueLabel: 'GH₵ 500', winners: 10, description: '' },
    ],
    fields: details(),
    settings: { quiz: null },
    ...over,
  });

  it('rejects a request with no session, and a write without CSRF or from another origin', async () => {
    expect((await request(app).get('/api/v1/campaigns')).status).toBe(401);
    const o = people.owner;
    const noToken = await request(app)
      .post('/api/v1/campaigns')
      .set('Cookie', o.cookie)
      .set('Origin', ORIGIN)
      .send({ title: 'x' });
    expect(noToken.status).toBe(403);
    const evil = await request(app)
      .post('/api/v1/campaigns')
      .set('Cookie', o.cookie)
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', o.csrf)
      .send({ title: 'x' });
    expect(evil.status).toBe(403);
  });

  describe('the built-in campaign types', () => {
    it('lists the four types with what each allows, to anyone in a business', async () => {
      for (const p of [people.owner, people.analyst, people.outsider]) {
        const res = await read(p, 'templates');
        expect(res.status).toBe(200);
        expect(res.body.items.map((t: { slug: string }) => t.slug)).toEqual([
          'quiz',
          'survey',
          'giveaway',
          'instant',
        ]);
      }
      const quiz = (await read(people.owner, 'templates')).body.items[0];
      expect(quiz).toMatchObject({ id: SEEDED.quiz, archetype: 'quiz', minContentFields: 1 });
      expect(quiz.fields.map((f: { kind: string }) => f.kind)).toContain('quiz_question');
      expect((await read(people.owner, `templates/${SEEDED.giveaway}`)).body).toMatchObject({
        requiresPrizes: true,
      });
      expect((await read(people.owner, `templates/${randomUUID()}`)).status).toBe(404);
    });

    it('is closed to visitors and participants, and cannot be written by a business', async () => {
      expect((await request(app).get('/api/v1/templates')).status).toBe(401);
      expect((await read(people.participant, 'templates')).status).toBe(403);
      for (const attempt of [
        () => write(people.owner, 'post', 'templates', { name: 'Mine', archetype: 'quiz' }),
        () => write(people.owner, 'put', `templates/${SEEDED.quiz}`, { name: 'Hijacked' }),
        () => write(people.owner, 'delete', `templates/${SEEDED.quiz}`),
      ]) {
        expect((await attempt()).status).toBe(404);
      }
      expect((await read(people.owner, `templates/${SEEDED.quiz}`)).body.name).toBe('Quiz');
    });
  });

  it('runs the whole workflow, from a new campaign with its type to cancelled', async () => {
    const owner = people.owner;
    const created = await write(owner, 'post', 'campaigns', {
      title: 'Black Friday Giveaway',
      templateId: SEEDED.giveaway,
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    // A new campaign starts with what its type begins with.
    expect(created.body.fields.map((f: { kind: string }) => f.kind)).toEqual(['email', 'consent']);
    expect(created.body.template).toMatchObject({ id: SEEDED.giveaway, archetype: 'giveaway' });

    const saved = await write(owner, 'put', `campaigns/${id}`, {
      expectedVersion: 1,
      ...content(SEEDED.giveaway, {
        fields: [...details(), field('phone', { label: 'Mobile number' })],
      }),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.prizes.map((p: { name: string }) => p.name)).toEqual([
      'Grand prize',
      'Runner-up',
    ]);
    expect(saved.body.fields.map((f: { key: string }) => f.key)).toEqual([
      'email',
      'consent',
      'phone',
    ]);

    expect(
      (
        await write(owner, 'put', `campaigns/${id}`, {
          expectedVersion: 1,
          ...content(SEEDED.giveaway),
        })
      ).status,
    ).toBe(412);

    const launched = await write(owner, 'post', `campaigns/${id}/launch`, { expectedVersion: 2 });
    expect(launched.status).toBe(200);
    expect(launched.body.status).toBe('LIVE');
    expect(launched.body.slug).toMatch(/^black-friday-giveaway-[0-9a-f]{6}$/);

    // Launched: the content is fixed.
    expect(
      (
        await write(owner, 'put', `campaigns/${id}`, {
          expectedVersion: 3,
          ...content(SEEDED.giveaway),
        })
      ).body.error.code,
    ).toBe('CAMPAIGN_LOCKED');

    const paused = await write(owner, 'post', `campaigns/${id}/pause`, { expectedVersion: 3 });
    expect(paused.body.status).toBe('PAUSED');
    const cancelled = await write(owner, 'post', `campaigns/${id}/cancel`, { expectedVersion: 4 });
    expect(cancelled.body.status).toBe('CANCELLED');

    const actions = (
      await platform.auditLog.findMany({ where: { tenantId: tenantA, targetId: id } })
    ).map((r) => r.action);
    expect(actions.sort()).toEqual([
      'campaign.cancelled',
      'campaign.created',
      'campaign.launched',
      'campaign.paused',
      'campaign.updated',
    ]);
  });

  it('writes a quiz on the campaign: the questions, the correct answers and the settings', async () => {
    const owner = people.owner;
    const created = await write(owner, 'post', 'campaigns', {
      title: 'Tech quiz',
      templateId: SEEDED.quiz,
    });
    const id = created.body.id as string;
    expect(created.body.settings).toEqual({ quiz: { timeLimitMinutes: null, passPercent: 70 } });

    const question = (label: string, options: string[], correctIndex: number | null) =>
      field('quiz_question', { label, options, correctIndex, required: true });
    const body = (fields: unknown[], over: Record<string, unknown> = {}) =>
      content(SEEDED.quiz, {
        title: 'Tech quiz',
        prizes: [],
        settings: { quiz: { timeLimitMinutes: 20, passPercent: 60 } },
        fields,
        ...over,
      });

    // A draft can be saved unfinished, but launching needs it finished.
    const unfinished = await write(owner, 'put', `campaigns/${id}`, {
      expectedVersion: 1,
      ...body([...details(), question('Capital of Ghana?', ['Accra', 'Kumasi'], null)]),
    });
    expect(unfinished.status).toBe(200);
    const refused = await write(owner, 'post', `campaigns/${id}/launch`, {
      expectedVersion: unfinished.body.version,
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.failed).toEqual(['content']);

    const finished = await write(owner, 'put', `campaigns/${id}`, {
      expectedVersion: unfinished.body.version,
      ...body([
        ...details(),
        question('Capital of Ghana?', ['Accra', 'Kumasi'], 0),
        question('2 + 2?', ['3', '4', '5'], 1),
      ]),
    });
    expect(finished.status).toBe(200);
    expect(finished.body.settings).toEqual({ quiz: { timeLimitMinutes: 20, passPercent: 60 } });
    expect(
      finished.body.fields
        .filter((f: { kind: string }) => f.kind === 'quiz_question')
        .map((f: { label: string; correctIndex: number }) => [f.label, f.correctIndex]),
    ).toEqual([
      ['Capital of Ghana?', 0],
      ['2 + 2?', 1],
    ]);

    const launched = await write(owner, 'post', `campaigns/${id}/launch`, {
      expectedVersion: finished.body.version,
    });
    expect(launched.status).toBe(200);

    // The kinds of field a type allows are enforced.
    const other = await write(owner, 'post', 'campaigns', {
      title: 'Wrong fields',
      templateId: SEEDED.giveaway,
    });
    const wrong = await write(owner, 'put', `campaigns/${other.body.id}`, {
      expectedVersion: 1,
      ...content(SEEDED.giveaway, { fields: [...details(), question('Q?', ['A', 'B'], 0)] }),
    });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.code).toBe('CAMPAIGN_INVALID');
  });

  it('shows a launched campaign on the public listing to a visitor, and takes it off when paused', async () => {
    const owner = people.owner;
    const title = `Public ${tag}`;
    const { body } = await write(owner, 'post', 'campaigns', {
      title,
      templateId: SEEDED.giveaway,
    });
    await write(owner, 'put', `campaigns/${body.id}`, {
      expectedVersion: 1,
      ...content(SEEDED.giveaway, { title }),
    });

    // No cookie, no session: this is what a visitor's browser sends.
    const listing = () =>
      request(app).get(`/api/v1/public/campaigns?q=${encodeURIComponent(title)}`);
    expect((await listing()).body.items).toEqual([]); // a draft is not public

    const live = await write(owner, 'post', `campaigns/${body.id}/launch`, { expectedVersion: 2 });
    const res = await listing();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: body.id,
      slug: live.body.slug,
      title,
      summary: 'Win big',
      businessName: `E2E-CA-${tag}`,
      type: 'giveaway',
      timeZone: 'UTC',
      prize: { label: 'Grand prize', value: 'GH₵ 5,000' },
    });
    expect(JSON.stringify(res.body)).not.toContain(tenantA);

    const paused = await write(owner, 'post', `campaigns/${body.id}/pause`, {
      expectedVersion: live.body.version,
    });
    expect((await listing()).body.items).toEqual([]);
    const resumed = await write(owner, 'post', `campaigns/${body.id}/resume`, {
      expectedVersion: paused.body.version,
    });
    expect((await listing()).body.items).toHaveLength(1);
    await write(owner, 'post', `campaigns/${body.id}/cancel`, {
      expectedVersion: resumed.body.version,
    });
    expect((await listing()).body.items).toEqual([]);
  });

  it('explains a failed launch and keeps drafts editable', async () => {
    const owner = people.owner;
    const { body } = await write(owner, 'post', 'campaigns', { title: 'Bare' });
    const res = await write(owner, 'post', `campaigns/${body.id}/launch`, { expectedVersion: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.details.failed).toEqual(['template', 'schedule', 'details']);
    expect((await read(owner, `campaigns/${body.id}`)).body.status).toBe('DRAFT');
  });

  it('lets an operator pause and resume but not launch, and an analyst only read', async () => {
    const owner = people.owner;
    const { body } = await write(owner, 'post', 'campaigns', {
      title: 'Ops',
      templateId: SEEDED.giveaway,
    });
    await write(owner, 'put', `campaigns/${body.id}`, {
      expectedVersion: 1,
      ...content(SEEDED.giveaway, { title: 'Ops' }),
    });

    expect(
      (await write(people.operator, 'post', `campaigns/${body.id}/launch`, { expectedVersion: 2 }))
        .status,
    ).toBe(403);
    const live = await write(owner, 'post', `campaigns/${body.id}/launch`, { expectedVersion: 2 });
    const paused = await write(people.operator, 'post', `campaigns/${body.id}/pause`, {
      expectedVersion: live.body.version,
    });
    expect(paused.body.status).toBe('PAUSED');
    expect(
      (
        await write(people.operator, 'post', `campaigns/${body.id}/resume`, {
          expectedVersion: paused.body.version,
        })
      ).body.status,
    ).toBe('LIVE');

    expect((await read(people.analyst, 'campaigns')).status).toBe(200);
    expect((await write(people.analyst, 'post', 'campaigns', { title: 'x' })).status).toBe(403);
    expect(
      (await write(people.analyst, 'post', `campaigns/${body.id}/pause`, { expectedVersion: 99 }))
        .status,
    ).toBe(403);
  });

  it('keeps another business out of a campaign and its fields', async () => {
    const owner = people.owner;
    const outsider = people.outsider;
    const { body } = await write(owner, 'post', 'campaigns', {
      title: 'Mine',
      templateId: SEEDED.giveaway,
    });
    expect((await read(outsider, `campaigns/${body.id}`)).status).toBe(404);
    expect(
      (
        await write(outsider, 'put', `campaigns/${body.id}`, {
          expectedVersion: 1,
          ...content(SEEDED.giveaway),
        })
      ).status,
    ).toBe(404);
    expect(
      (await read(outsider, 'campaigns')).body.items.map((c: { id: string }) => c.id),
    ).not.toContain(body.id);

    // The built-in types are shared, so another business can use them for its own campaign.
    const theirs = await write(outsider, 'post', 'campaigns', {
      title: 'Theirs',
      templateId: SEEDED.giveaway,
    });
    expect(theirs.status).toBe(201);
    expect(theirs.body.fields.map((f: { kind: string }) => f.kind)).toEqual(['email', 'consent']);
  });
});

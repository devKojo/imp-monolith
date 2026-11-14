/**
 * End to end for campaigns and their link to templates: the real app, the real identity guards
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
import { PrismaCampaignUsage, createCampaignsModule } from './modules/campaigns';
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
  const people: Record<'owner' | 'operator' | 'analyst' | 'outsider', Person> = {} as never;
  const userIds: string[] = [];
  let app: Awaited<ReturnType<typeof createApp>>;

  async function person(
    tenantId: string,
    role: 'BUSINESS_OWNER' | 'CAMPAIGN_OPERATOR' | 'ANALYST',
    name: string,
  ): Promise<Person> {
    const user = await platform.user.create({
      data: { email: `${name}-${tag}@test.local`, name, emailVerifiedAt: new Date() },
    });
    userIds.push(user.id);
    const membership = await platform.membership.create({
      data: { tenantId, userId: user.id, role },
    });
    const token = generateToken();
    const tokenHash = hashToken(token);
    await platform.session.create({
      data: {
        tokenHash,
        userId: user.id,
        activeTenantId: tenantId,
        activeMembershipId: membership.id,
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

    const identity = createIdentityModule({ db, allowedOrigins: [ORIGIN], sessionSecret: SECRET });
    const templates = createTemplatesModule({ db, identity, usage: new PrismaCampaignUsage(db) });
    const campaigns = createCampaignsModule({ db, identity, templates: templates.lookup });
    app = await createApp({ bus: new InMemoryEventBus(), identity, templates, campaigns });
  });

  afterAll(async () => {
    const tenants = [tenantA, tenantB];
    await platform.campaignPrize.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.campaign.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.templateField.deleteMany({ where: { tenantId: { in: tenants } } });
    await platform.template.deleteMany({ where: { tenantId: { in: tenants } } });
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

  /** A published template of business A, made through the real templates API. */
  async function publishedTemplate(): Promise<string> {
    const o = people.owner;
    const t = (await write(o, 'post', 'templates', { name: 'Entry', archetype: 'giveaway' })).body;
    await write(o, 'put', `templates/${t.id}`, {
      expectedVersion: 1,
      name: 'Entry',
      archetype: 'giveaway',
      fields: [
        { kind: 'email', key: 'email', label: 'Email', helper: '', required: true, options: [] },
        {
          kind: 'consent',
          key: 'consent',
          label: 'I agree',
          helper: '',
          required: true,
          options: [],
        },
      ],
    });
    expect(
      (await write(o, 'post', `templates/${t.id}/publish`, { expectedVersion: 2 })).status,
    ).toBe(200);
    return t.id as string;
  }

  const content = (templateId: string | null, over: Record<string, unknown> = {}) => ({
    title: 'Black Friday Giveaway',
    summary: 'Win big',
    templateId,
    startAt: null,
    endAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    prizes: [
      { name: 'Grand prize', valueLabel: 'GH₵ 5,000', winners: 1, description: 'The big one' },
      { name: 'Runner-up', valueLabel: 'GH₵ 500', winners: 10, description: '' },
    ],
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

  it('runs the whole workflow, and the template is protected while a campaign uses it', async () => {
    const owner = people.owner;
    const templateId = await publishedTemplate();

    const created = await write(owner, 'post', 'campaigns', { title: 'Black Friday Giveaway' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const saved = await write(owner, 'put', `campaigns/${id}`, {
      expectedVersion: 1,
      ...content(templateId),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.prizes.map((p: { name: string }) => p.name)).toEqual([
      'Grand prize',
      'Runner-up',
    ]);
    expect(saved.body.template).toMatchObject({
      id: templateId,
      status: 'PUBLISHED',
      archetype: 'giveaway',
    });

    expect(
      (await write(owner, 'put', `campaigns/${id}`, { expectedVersion: 1, ...content(templateId) }))
        .status,
    ).toBe(412);

    const launched = await write(owner, 'post', `campaigns/${id}/launch`, { expectedVersion: 2 });
    expect(launched.status).toBe(200);
    expect(launched.body.status).toBe('LIVE');
    expect(launched.body.slug).toMatch(/^black-friday-giveaway-[0-9a-f]{6}$/);

    // A running campaign uses the template: it cannot be unpublished or deleted.
    const tpl = (await read(owner, `templates/${templateId}`)).body;
    const blocked = await write(owner, 'post', `templates/${templateId}/unpublish`, {
      expectedVersion: tpl.version,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('TEMPLATE_IN_USE');

    const paused = await write(owner, 'post', `campaigns/${id}/pause`, { expectedVersion: 3 });
    expect(paused.body.status).toBe('PAUSED');
    expect(
      (
        await write(owner, 'post', `templates/${templateId}/unpublish`, {
          expectedVersion: tpl.version,
        })
      ).status,
    ).toBe(409);

    const cancelled = await write(owner, 'post', `campaigns/${id}/cancel`, { expectedVersion: 4 });
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(
      (
        await write(owner, 'post', `templates/${templateId}/unpublish`, {
          expectedVersion: tpl.version,
        })
      ).status,
    ).toBe(200);

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

  it('explains a failed launch and keeps drafts editable', async () => {
    const owner = people.owner;
    const { body } = await write(owner, 'post', 'campaigns', { title: 'Bare' });
    const res = await write(owner, 'post', `campaigns/${body.id}/launch`, { expectedVersion: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.details.failed).toEqual(['template', 'schedule']);
    expect((await read(owner, `campaigns/${body.id}`)).body.status).toBe('DRAFT');
  });

  it('lets an operator pause and resume but not launch, and an analyst only read', async () => {
    const owner = people.owner;
    const templateId = await publishedTemplate();
    const { body } = await write(owner, 'post', 'campaigns', { title: 'Ops' });
    await write(owner, 'put', `campaigns/${body.id}`, {
      expectedVersion: 1,
      ...content(templateId, { title: 'Ops' }),
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

  it('keeps another business out, and will not use its template', async () => {
    const owner = people.owner;
    const outsider = people.outsider;
    const templateId = await publishedTemplate();
    const { body } = await write(owner, 'post', 'campaigns', { title: 'Mine' });

    expect((await read(outsider, `campaigns/${body.id}`)).status).toBe(404);
    expect(
      (await read(outsider, 'campaigns')).body.items.some((c: { id: string }) => c.id === body.id),
    ).toBe(false);
    expect(
      (
        await write(outsider, 'put', `campaigns/${body.id}`, {
          expectedVersion: 1,
          ...content(null),
        })
      ).status,
    ).toBe(404);
    expect((await write(outsider, 'delete', `campaigns/${body.id}`)).status).toBe(404);

    const theirs = (await write(outsider, 'post', 'campaigns', { title: 'Theirs' })).body;
    const steal = await write(outsider, 'put', `campaigns/${theirs.id}`, {
      expectedVersion: 1,
      ...content(templateId),
    });
    expect(steal.status).toBe(422);
    expect(steal.body.error.code).toBe('CAMPAIGN_INVALID');
    expect((await write(outsider, 'post', 'campaigns', { title: 'x', templateId })).status).toBe(
      422,
    );
  });
});

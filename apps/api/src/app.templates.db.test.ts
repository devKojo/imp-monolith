/**
 * End to end for templates: the real app, the real identity guards (session cookie, CSRF, Origin),
 * the real routes and real PostgreSQL with the real roles and RLS. Sessions are created directly in
 * the test database, so no email or password flow is involved. Skipped unless the same
 * TEST_DATABASE_URL_RUNTIME / _PLATFORM variables as the isolation suite are set.
 */
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { InMemoryEventBus } from './infrastructure/messaging/in-memory-event-bus';
import { createIdentityModule } from './modules/identity';
import { generateToken, hashToken, csrfTokenFor } from './modules/identity/domain/tokens';
import { createTemplatesModule } from './modules/templates';
import { createPlatformDb, createTenantDb } from './shared/database';

config({ path: ['.env', '../../.env'], quiet: true });
const runtimeUrl = process.env.TEST_DATABASE_URL_RUNTIME;
const platformUrl = process.env.TEST_DATABASE_URL_PLATFORM;
const enabled = Boolean(runtimeUrl && platformUrl);

const ORIGIN = 'http://localhost:3001';
const SECRET = 's'.repeat(32);

describe.skipIf(!enabled)('templates API end to end (real guards, real PostgreSQL)', () => {
  const db = createTenantDb({ connectionString: runtimeUrl ?? '', poolMax: 6 });
  const platform = createPlatformDb({ connectionString: platformUrl ?? '', poolMax: 2 });
  const tag = randomUUID().slice(0, 8);

  type Person = { cookie: string; csrf: string; userId: string };
  let tenantA = '';
  let tenantB = '';
  const people: Record<'owner' | 'analyst' | 'outsider', Person> = {} as never;
  const userIds: string[] = [];
  let app: Awaited<ReturnType<typeof createApp>>;

  async function person(
    tenantId: string,
    role: 'BUSINESS_OWNER' | 'ANALYST',
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
    return {
      cookie: `__Host-sid=${token}`,
      csrf: csrfTokenFor(SECRET, tokenHash),
      userId: user.id,
    };
  }

  beforeAll(async () => {
    const [a, b] = await Promise.all([
      platform.business.create({ data: { name: `E2E-A-${tag}` } }),
      platform.business.create({ data: { name: `E2E-B-${tag}` } }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    people.owner = await person(tenantA, 'BUSINESS_OWNER', 'owner');
    people.analyst = await person(tenantA, 'ANALYST', 'analyst');
    people.outsider = await person(tenantB, 'BUSINESS_OWNER', 'outsider');

    const identity = createIdentityModule({ db, allowedOrigins: [ORIGIN], sessionSecret: SECRET });
    const templates = createTemplatesModule({ db, identity });
    app = await createApp({ bus: new InMemoryEventBus(), identity, templates });
  });

  afterAll(async () => {
    await platform.templateField.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await platform.template.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await platform.session.deleteMany({ where: { userId: { in: userIds } } });
    await platform.membership.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await platform.user.deleteMany({ where: { id: { in: userIds } } });
    await platform.business.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await Promise.all([db.$disconnect(), platform.$disconnect()]);
  });

  const read = (p: Person, url = '') =>
    request(app).get(`/api/v1/templates${url}`).set('Cookie', p.cookie);
  const write = (p: Person, method: 'post' | 'put' | 'delete', url: string, body?: object) =>
    request(app)
      [method](`/api/v1/templates${url}`)
      .set('Cookie', p.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', p.csrf)
      .send(body);

  const fields = [
    {
      kind: 'email',
      key: 'email',
      label: 'Email address',
      helper: '',
      required: true,
      options: [],
    },
    { kind: 'consent', key: 'consent', label: 'I agree', helper: '', required: true, options: [] },
  ];

  it('rejects a request with no session', async () => {
    expect((await request(app).get('/api/v1/templates')).status).toBe(401);
  });

  it('rejects a write without the CSRF token or from another origin', async () => {
    const o = people.owner;
    const noToken = await request(app)
      .post('/api/v1/templates')
      .set('Cookie', o.cookie)
      .set('Origin', ORIGIN)
      .send({ name: 'x', archetype: 'quiz' });
    expect(noToken.status).toBe(403);
    const evil = await request(app)
      .post('/api/v1/templates')
      .set('Cookie', o.cookie)
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', o.csrf)
      .send({ name: 'x', archetype: 'quiz' });
    expect(evil.status).toBe(403);
  });

  it('runs the whole workflow and writes the audit trail', async () => {
    const owner = people.owner;
    const created = await write(owner, 'post', '', { name: 'Entry', archetype: 'giveaway' });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const saved = await write(owner, 'put', `/${id}`, {
      expectedVersion: 1,
      name: 'Entry',
      archetype: 'giveaway',
      fields,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.fields.map((f: { key: string }) => f.key)).toEqual(['email', 'consent']);

    const stale = await write(owner, 'put', `/${id}`, {
      expectedVersion: 1,
      name: 'Late',
      archetype: 'giveaway',
      fields: [],
    });
    expect(stale.status).toBe(412);

    const published = await write(owner, 'post', `/${id}/publish`, { expectedVersion: 2 });
    expect(published.body).toMatchObject({ status: 'PUBLISHED', version: 3 });
    expect(
      (
        await write(owner, 'put', `/${id}`, {
          expectedVersion: 3,
          name: 'x',
          archetype: 'quiz',
          fields: [],
        })
      ).status,
    ).toBe(409);

    const copy = await write(owner, 'post', `/${id}/duplicate`, {});
    expect(copy.body).toMatchObject({ name: 'Entry (copy)', status: 'DRAFT' });
    expect((await write(owner, 'delete', `/${copy.body.id}`)).status).toBe(204);
    expect((await read(owner, `/${copy.body.id}`)).status).toBe(404);

    expect(
      (await write(owner, 'post', `/${id}/unpublish`, { expectedVersion: 3 })).body.status,
    ).toBe('DRAFT');

    const actions = (
      await platform.auditLog.findMany({ where: { tenantId: tenantA, targetId: id } })
    ).map((r) => r.action);
    expect(actions.sort()).toEqual([
      'template.created',
      'template.published',
      'template.unpublished',
      'template.updated',
    ]);
  });

  it('explains a failed publish', async () => {
    const owner = people.owner;
    const { body } = await write(owner, 'post', '', { name: 'Empty', archetype: 'quiz' });
    const res = await write(owner, 'post', `/${body.id}/publish`, { expectedVersion: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.details.failed).toEqual(['fields', 'identity', 'consent', 'labels']);
  });

  it('lets an analyst read but not change', async () => {
    const { body } = await write(people.owner, 'post', '', {
      name: 'Visible',
      archetype: 'survey',
    });
    const list = await read(people.analyst);
    expect(list.status).toBe(200);
    expect(list.body.items.some((t: { id: string }) => t.id === body.id)).toBe(true);
    expect((await write(people.analyst, 'post', '', { name: 'x', archetype: 'quiz' })).status).toBe(
      403,
    );
    expect((await write(people.analyst, 'delete', `/${body.id}`)).status).toBe(403);
  });

  it('keeps another business out', async () => {
    const { body } = await write(people.owner, 'post', '', { name: 'Mine', archetype: 'quiz' });
    expect((await read(people.outsider, `/${body.id}`)).status).toBe(404);
    expect(
      (await read(people.outsider)).body.items.some((t: { id: string }) => t.id === body.id),
    ).toBe(false);
    expect(
      (
        await write(people.outsider, 'put', `/${body.id}`, {
          expectedVersion: 1,
          name: 'Hijack',
          archetype: 'quiz',
          fields: [],
        })
      ).status,
    ).toBe(404);
    expect((await write(people.outsider, 'delete', `/${body.id}`)).status).toBe(404);
  });
});

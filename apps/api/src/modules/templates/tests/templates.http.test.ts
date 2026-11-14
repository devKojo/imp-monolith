import { randomUUID } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuthContext } from '@/modules/identity';
import { errorHandler, notFound } from '@/shared/http';
import { TemplatesService } from '../application/templates.service';
import { templatesRouter } from '../http/templates.routes';
import { InMemoryTemplateRepository } from './fakes';
import { field } from './repository.contract';

const CSRF = 'csrf-token';
const tenantId = randomUUID();

/** Stand-in for the identity guards: the role comes from a test header, "none" is signed out. */
const guards: RequestHandler[] = [
  (req, _res, next) => {
    const role = String(req.headers['x-test-role'] ?? 'BUSINESS_OWNER');
    if (role !== 'none') {
      req.auth = {
        userId: '00000000-0000-4000-8000-000000000001',
        accountType: role === 'PARTICIPANT' ? 'PARTICIPANT' : 'BUSINESS',
        active: role === 'PARTICIPANT' ? null : { membershipId: randomUUID(), tenantId, role },
        csrfToken: CSRF,
      } as unknown as AuthContext;
    }
    next();
  },
];

function build() {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/templates',
    templatesRouter(new TemplatesService(new InMemoryTemplateRepository()), guards),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const api = (app: express.Express, role = 'BUSINESS_OWNER') => ({
  get: (url: string) => request(app).get(`/api/v1/templates${url}`).set('x-test-role', role),
  write: (method: 'post' | 'put' | 'delete', url: string, body?: object) =>
    request(app)
      [method](`/api/v1/templates${url}`)
      .set('x-test-role', role)
      .set('x-csrf-token', CSRF)
      .send(body),
});

describe('templates HTTP', () => {
  it('requires a session for reads and a CSRF token for writes', async () => {
    const app = build();
    expect((await api(app, 'none').get('/')).status).toBe(401);
    const noToken = await request(app)
      .post('/api/v1/templates')
      .send({ name: 'x', archetype: 'quiz' });
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('CSRF_FAILED');
  });

  it('sends no-store on every response', async () => {
    expect((await api(build()).get('/')).headers['cache-control']).toBe('no-store');
  });

  it('refuses a participant account', async () => {
    const res = await api(build(), 'PARTICIPANT').get('/');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NO_ACTIVE_BUSINESS');
  });

  it('runs the create, edit, publish, unpublish, duplicate and delete workflow', async () => {
    const app = build();
    const owner = api(app);

    const created = await owner.write('post', '/', { name: 'Entry', archetype: 'giveaway' });
    expect(created.status).toBe(201);
    const { id } = created.body;

    const saved = await owner.write('put', `/${id}`, {
      expectedVersion: 1,
      name: 'Entry',
      archetype: 'giveaway',
      fields: [field(), field({ kind: 'consent', key: 'consent', label: 'I agree' })],
    });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(2);

    const published = await owner.write('post', `/${id}/publish`, { expectedVersion: 2 });
    expect(published.body).toMatchObject({ status: 'PUBLISHED', version: 3 });

    const list = await owner.get('/?status=PUBLISHED');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id, fieldCount: 2 });

    expect((await owner.write('delete', `/${id}`)).body.error.code).toBe('TEMPLATE_PUBLISHED');
    const back = await owner.write('post', `/${id}/unpublish`, { expectedVersion: 3 });
    expect(back.body.status).toBe('DRAFT');

    const copy = await owner.write('post', `/${id}/duplicate`, {});
    expect(copy.status).toBe(201);
    expect(copy.body.name).toBe('Entry (copy)');

    expect((await owner.write('delete', `/${id}`)).status).toBe(204);
    expect((await owner.get(`/${id}`)).status).toBe(404);
  });

  it('explains why publishing failed', async () => {
    const app = build();
    const owner = api(app);
    const { body } = await owner.write('post', '/', { name: 'Empty', archetype: 'quiz' });
    const res = await owner.write('post', `/${body.id}/publish`, { expectedVersion: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'PREFLIGHT_FAILED',
      details: { failed: ['fields', 'identity', 'consent', 'labels'] },
    });
  });

  it('answers 412 for a stale save', async () => {
    const app = build();
    const owner = api(app);
    const { body } = await owner.write('post', '/', { name: 'T', archetype: 'quiz' });
    const res = await owner.write('put', `/${body.id}`, {
      expectedVersion: 7,
      name: 'T',
      archetype: 'quiz',
      fields: [],
    });
    expect(res.status).toBe(412);
    expect(res.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('validates input and rejects unknown keys and bad ids', async () => {
    const app = build();
    const owner = api(app);
    expect((await owner.write('post', '/', { name: '', archetype: 'quiz' })).status).toBe(400);
    expect((await owner.write('post', '/', { name: 'x', archetype: 'nope' })).status).toBe(400);
    expect(
      (await owner.write('post', '/', { name: 'x', archetype: 'quiz', tenantId: randomUUID() }))
        .status,
    ).toBe(400);
    expect((await owner.get('/not-a-uuid')).status).toBe(400);
    const { body } = await owner.write('post', '/', { name: 'T', archetype: 'quiz' });
    const badKey = await owner.write('put', `/${body.id}`, {
      expectedVersion: 1,
      name: 'T',
      archetype: 'quiz',
      fields: [field({ key: 'Bad Key' })],
    });
    expect(badKey.status).toBe(400);
  });

  it('lets read-only roles read and blocks their writes with 403', async () => {
    const app = build();
    const { body } = await api(app).write('post', '/', { name: 'T', archetype: 'quiz' });
    const analyst = api(app, 'ANALYST');
    expect((await analyst.get('/')).status).toBe(200);
    expect((await analyst.get(`/${body.id}`)).status).toBe(200);
    expect((await analyst.write('delete', `/${body.id}`)).status).toBe(403);
    expect((await analyst.write('post', '/', { name: 'x', archetype: 'quiz' })).status).toBe(403);
  });
});

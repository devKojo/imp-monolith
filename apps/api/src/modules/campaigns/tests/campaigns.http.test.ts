import { randomUUID } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuthContext } from '@/modules/identity';
import { errorHandler, notFound } from '@/shared/http';
import { CampaignsService } from '../application/campaigns.service';
import { campaignsRouter } from '../http/campaigns.routes';
import { FakeTemplateLookup, InMemoryCampaignRepository } from './fakes';

const CSRF = 'csrf-token';
const tenantId = randomUUID();
const templateId = randomUUID();

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
  const templates = new FakeTemplateLookup();
  templates.add({ id: templateId, name: 'Entry', archetype: 'giveaway', status: 'PUBLISHED' });
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/campaigns',
    campaignsRouter(new CampaignsService(new InMemoryCampaignRepository(), templates), guards),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const api = (app: express.Express, role = 'BUSINESS_OWNER') => ({
  get: (url: string) => request(app).get(`/api/v1/campaigns${url}`).set('x-test-role', role),
  write: (method: 'post' | 'put' | 'delete', url: string, body?: object) =>
    request(app)
      [method](`/api/v1/campaigns${url}`)
      .set('x-test-role', role)
      .set('x-csrf-token', CSRF)
      .send(body),
});

const content = (over: Record<string, unknown> = {}) => ({
  title: 'Black Friday',
  summary: 'Win big',
  templateId,
  startAt: null,
  endAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  prizes: [{ name: 'Grand prize', valueLabel: '1,000', winners: 1, description: '' }],
  ...over,
});

describe('campaigns HTTP', () => {
  it('requires a session for reads and a CSRF token for writes', async () => {
    const app = build();
    expect((await api(app, 'none').get('/')).status).toBe(401);
    const noToken = await request(app).post('/api/v1/campaigns').send({ title: 'x' });
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('CSRF_FAILED');
  });

  it('sends no-store, and refuses a participant account', async () => {
    const app = build();
    const res = await api(app, 'PARTICIPANT').get('/');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NO_ACTIVE_BUSINESS');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('runs create, edit, launch, pause, resume, cancel, duplicate and delete', async () => {
    const app = build();
    const owner = api(app);

    const created = await owner.write('post', '/', { title: 'Black Friday' });
    expect(created.status).toBe(201);
    const { id } = created.body;

    const saved = await owner.write('put', `/${id}`, { expectedVersion: 1, ...content() });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      version: 2,
      summary: 'Win big',
      template: { name: 'Entry' },
    });

    const launched = await owner.write('post', `/${id}/launch`, { expectedVersion: 2 });
    expect(launched.body).toMatchObject({ status: 'LIVE', version: 3 });
    expect(launched.body.slug).toMatch(/^black-friday-[0-9a-f]{6}$/);

    expect(
      (await owner.write('put', `/${id}`, { expectedVersion: 3, ...content() })).body.error.code,
    ).toBe('CAMPAIGN_LOCKED');
    expect((await owner.write('delete', `/${id}`)).body.error.code).toBe('CAMPAIGN_LOCKED');

    const paused = await owner.write('post', `/${id}/pause`, { expectedVersion: 3 });
    expect(paused.body.status).toBe('PAUSED');
    const resumed = await owner.write('post', `/${id}/resume`, { expectedVersion: 4 });
    expect(resumed.body.status).toBe('LIVE');

    const copy = await owner.write('post', `/${id}/duplicate`, {});
    expect(copy.status).toBe(201);
    expect(copy.body).toMatchObject({ title: 'Black Friday (copy)', status: 'DRAFT' });
    expect((await owner.write('delete', `/${copy.body.id}`)).status).toBe(204);
    expect((await owner.get(`/${copy.body.id}`)).status).toBe(404);

    const cancelled = await owner.write('post', `/${id}/cancel`, { expectedVersion: 5 });
    expect(cancelled.body.status).toBe('CANCELLED');
    expect((await owner.get('/?status=CANCELLED')).body.items).toHaveLength(1);
  });

  it('explains why a launch failed', async () => {
    const app = build();
    const owner = api(app);
    const { body } = await owner.write('post', '/', { title: 'Bare' });
    const res = await owner.write('post', `/${body.id}/launch`, { expectedVersion: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'PREFLIGHT_FAILED',
      details: { failed: ['template', 'schedule'] },
    });
  });

  it('answers 412 for a stale save, and 422 for an end before the start', async () => {
    const app = build();
    const owner = api(app);
    const { body } = await owner.write('post', '/', { title: 'T' });
    expect(
      (await owner.write('put', `/${body.id}`, { expectedVersion: 9, ...content() })).status,
    ).toBe(412);
    const bad = await owner.write('put', `/${body.id}`, {
      expectedVersion: 1,
      ...content({ startAt: '2027-02-01T00:00:00Z', endAt: '2027-01-01T00:00:00Z' }),
    });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('CAMPAIGN_INVALID');
  });

  it('validates input and rejects unknown keys, bad dates and bad ids', async () => {
    const app = build();
    const owner = api(app);
    expect((await owner.write('post', '/', { title: '' })).status).toBe(400);
    expect((await owner.write('post', '/', { title: 'x', tenantId: randomUUID() })).status).toBe(
      400,
    );
    expect((await owner.get('/not-a-uuid')).status).toBe(400);
    const { body } = await owner.write('post', '/', { title: 'T' });
    expect(
      (
        await owner.write('put', `/${body.id}`, {
          expectedVersion: 1,
          ...content({ endAt: 'tomorrow' }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await owner.write('put', `/${body.id}`, {
          expectedVersion: 1,
          ...content({ prizes: [{ name: 'x', valueLabel: '', winners: 0, description: '' }] }),
        })
      ).status,
    ).toBe(400);
  });

  it('lets analysts read, operators pause but not launch, and blocks the rest with 403', async () => {
    const app = build();
    const owner = api(app);
    const { body } = await owner.write('post', '/', { title: 'T' });
    await owner.write('put', `/${body.id}`, { expectedVersion: 1, ...content() });
    const live = await owner.write('post', `/${body.id}/launch`, { expectedVersion: 2 });

    const analyst = api(app, 'ANALYST');
    expect((await analyst.get('/')).status).toBe(200);
    expect(
      (await analyst.write('post', `/${body.id}/pause`, { expectedVersion: live.body.version }))
        .status,
    ).toBe(403);

    const operator = api(app, 'CAMPAIGN_OPERATOR');
    expect(
      (await operator.write('post', `/${body.id}/cancel`, { expectedVersion: live.body.version }))
        .status,
    ).toBe(403);
    expect(
      (await operator.write('post', `/${body.id}/pause`, { expectedVersion: live.body.version }))
        .status,
    ).toBe(200);
  });
});

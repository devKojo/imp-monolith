import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  PublicDiscoveryService,
  type PublicCampaignRepository,
  type PublicQuery,
} from '../application/public-discovery.service';
import { errorHandler, notFound } from '@/shared/http';
import { publicCampaignsRouter } from '../http/public.routes';
import {
  PAGE_SIZE,
  archetypesFor,
  decodeCursor,
  encodeCursor,
  toPublic,
  toPublicDetail,
  type PublicRow,
} from '../domain/public';

const NOW = new Date('2026-11-14T12:00:00Z');
const row = (n: number, over: Partial<PublicRow> = {}): PublicRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  slug: `campaign-${n}`,
  title: `Campaign ${n}`,
  summary: `About ${n}`,
  endAt: new Date(NOW.getTime() + n * 3_600_000),
  archetype: 'giveaway',
  businessName: 'Acme',
  prize: null,
  ...over,
});

class FakeRepo implements PublicCampaignRepository {
  calls: PublicQuery[] = [];
  constructor(private readonly rows: PublicRow[]) {}
  async find(query: PublicQuery) {
    this.calls.push(query);
    return this.rows
      .filter(
        (r) =>
          !query.after ||
          r.endAt > query.after.endAt ||
          (+r.endAt === +query.after.endAt && r.id > query.after.id),
      )
      .slice(0, query.limit);
  }
}

describe('mapping', () => {
  it('names the kind of campaign the way visitors see it', () => {
    expect(toPublic(row(1, { archetype: 'quiz' })).type).toBe('quiz');
    expect(toPublic(row(1, { archetype: 'survey' })).type).toBe('survey');
    expect(toPublic(row(1, { archetype: 'giveaway' })).type).toBe('giveaway');
    expect(toPublic(row(1, { archetype: 'instant' })).type).toBe('giveaway');
    expect(archetypesFor('giveaway').sort()).toEqual(['giveaway', 'instant']);
    expect(archetypesFor('quiz')).toEqual(['quiz']);
    expect(archetypesFor('poll')).toEqual([]);
    expect(archetypesFor('vote')).toEqual([]);
  });

  it('shows a prize value with its name, or the name alone, or nothing', () => {
    expect(
      toPublic(row(1, { prize: { name: 'Grand prize', valueLabel: 'GH₵ 5,000' } })).prize,
    ).toEqual({
      label: 'Grand prize',
      value: 'GH₵ 5,000',
    });
    expect(toPublic(row(1, { prize: { name: 'Coffee hamper', valueLabel: '' } })).prize).toEqual({
      label: 'Prize',
      value: 'Coffee hamper',
    });
    expect(toPublic(row(1, { prize: { name: '', valueLabel: '' } }))).not.toHaveProperty('prize');
    expect(toPublic(row(1))).not.toHaveProperty('prize');
  });

  it("adds every prize tier and the start to one campaign's page, and nothing else", () => {
    const tier = { name: 'Grand', valueLabel: '5,000', winners: 1, description: 'Cash' };
    const detail = toPublicDetail(
      row(1, { prizes: [tier], startAt: new Date('2026-11-01T00:00:00Z') }),
    );
    expect(detail.prizes).toEqual([tier]);
    expect(detail.startsAt).toBe('2026-11-01T00:00:00.000Z');
    expect(toPublicDetail(row(1))).toMatchObject({ prizes: [], startsAt: null });
    expect(Object.keys(detail).sort()).toEqual(
      [...Object.keys(toPublic(row(1))), 'prizes', 'startsAt'].sort(),
    );
  });

  it('gives only public fields, with the end as an ISO instant', () => {
    const item = toPublic(row(2));
    expect(Object.keys(item).sort()).toEqual([
      'businessName',
      'endsAt',
      'id',
      'slug',
      'summary',
      'timeZone',
      'title',
      'type',
    ]);
    expect(item.endsAt).toBe('2026-11-14T14:00:00.000Z');
  });
});

describe('cursor', () => {
  it('round-trips and rejects anything else', () => {
    const c = { endAt: NOW, id: '00000000-0000-4000-8000-000000000001' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    for (const bad of [
      '',
      'not-base64!',
      Buffer.from('{}').toString('base64url'),
      Buffer.from(JSON.stringify({ e: 'x', i: 'y' })).toString('base64url'),
    ]) {
      expect(() => decodeCursor(bad)).toThrow(/not valid/);
    }
  });
});

describe('discovery service', () => {
  it('returns one page and a cursor that continues exactly after it', async () => {
    const rows = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => row(i + 1));
    const repo = new FakeRepo(rows);
    const service = new PublicDiscoveryService(repo, () => NOW);
    const first = await service.list({});
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.nextCursor).not.toBeNull();
    const second = await service.list({ cursor: first.nextCursor! });
    expect(second.items.map((i) => i.slug)).toEqual(rows.slice(PAGE_SIZE).map((r) => r.slug));
    expect(second.nextCursor).toBeNull();
    expect(repo.calls[0]!.limit).toBe(PAGE_SIZE + 1);
  });

  it('ends without a cursor when everything fits', async () => {
    const service = new PublicDiscoveryService(new FakeRepo([row(1), row(2)]), () => NOW);
    expect(await service.list({})).toMatchObject({
      nextCursor: null,
      items: [{ slug: 'campaign-1' }, { slug: 'campaign-2' }],
    });
  });

  it('passes the search and the kind to the repository, and answers polls and votes with nothing', async () => {
    const repo = new FakeRepo([row(1)]);
    const service = new PublicDiscoveryService(repo, () => NOW);
    await service.list({ q: 'coffee', type: 'giveaway' });
    expect(repo.calls[0]).toMatchObject({
      q: 'coffee',
      archetypes: ['giveaway', 'instant'],
      now: NOW,
    });
    expect(await service.list({ type: 'poll' })).toEqual({ items: [], nextCursor: null });
    expect(repo.calls).toHaveLength(1);
  });

  it('answers 400 for a cursor it did not make', async () => {
    const service = new PublicDiscoveryService(new FakeRepo([]), () => NOW);
    await expect(service.list({ cursor: 'garbage' })).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_CURSOR',
    });
  });
});

describe('public HTTP', () => {
  const build = (rows: PublicRow[] = [row(1, { prize: { name: 'Prize', valueLabel: '100' } })]) => {
    const app = express();
    app.use(
      '/api/v1/public/campaigns',
      publicCampaignsRouter(new PublicDiscoveryService(new FakeRepo(rows), () => NOW)),
    );
    app.use(notFound);
    app.use(errorHandler);
    return app;
  };

  it('needs no session and is cacheable, with no cookies set', async () => {
    const res = await request(build()).get('/api/v1/public/campaigns');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toMatchObject({
      nextCursor: null,
      items: [{ slug: 'campaign-1', prize: { value: '100' } }],
    });
  });

  it('validates the query and rejects unknown keys and bad values', async () => {
    const app = build();
    for (const q of [
      'type=hologram',
      'q=' + 'x'.repeat(101),
      'cursor=' + 'x'.repeat(301),
      'tenantId=abc',
      'limit=5',
    ]) {
      expect((await request(app).get(`/api/v1/public/campaigns?${q}`)).status).toBe(400);
    }
    expect(
      (await request(app).get('/api/v1/public/campaigns?cursor=garbage')).body.error.code,
    ).toBe('INVALID_CURSOR');
  });

  it('is read-only', async () => {
    expect((await request(build()).post('/api/v1/public/campaigns').send({})).status).toBe(404);
  });
});

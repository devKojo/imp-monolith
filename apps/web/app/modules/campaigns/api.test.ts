// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../auth/api';
import { ApiError } from '../auth/errors';
import { createCampaignsApi, toUpdateBody } from './api';
import { campaignErrorKey } from './errors';
import { canManageCampaigns, canOperateCampaigns } from './permissions';
import type { Campaign } from './types';

type Call = { url: string; method: string; body?: unknown; headers?: Record<string, string> };

const campaign: Campaign = {
  id: 'c1',
  title: '  Black Friday ',
  summary: 'Win big',
  slug: null,
  status: 'DRAFT',
  templateId: 't1',
  template: { id: 't1', name: 'Entry', archetype: 'giveaway', status: 'PUBLISHED' },
  startAt: null,
  endAt: '2026-12-01T12:00:00.000Z',
  prizes: [{ id: 'client-id', name: 'Grand', valueLabel: '1,000', winners: 2, description: 'x' }],
  version: 4,
  updatedAt: '2026-11-14T10:00:00.000Z',
  launchedAt: null,
};

function client(reply: unknown = campaign, fails = false) {
  const calls: Call[] = [];
  const fetcher: Fetcher = async <T>(
    url: string,
    opts: { method: string; body?: unknown; headers?: Record<string, string> },
  ) => {
    calls.push({ url, ...opts });
    if (fails) throw reply;
    return reply as T;
  };
  return { api: createCampaignsApi(fetcher), calls };
}

describe('save body', () => {
  it('sends the version that was read, the trimmed title, and prizes without client ids', () => {
    const body = toUpdateBody(campaign);
    expect(body).toMatchObject({
      expectedVersion: 4,
      title: 'Black Friday',
      templateId: 't1',
      startAt: null,
      endAt: '2026-12-01T12:00:00.000Z',
    });
    expect(body.prizes[0]).not.toHaveProperty('id');
    expect(Object.keys(body.prizes[0]!).sort()).toEqual([
      'description',
      'name',
      'valueLabel',
      'winners',
    ]);
  });
});

describe('client', () => {
  it('lists without a CSRF header', async () => {
    const { api, calls } = client({ items: [{ id: 'c1' }] });
    expect(await api.list()).toEqual([{ id: 'c1' }]);
    expect(calls[0]).toMatchObject({ url: '/api/v1/campaigns', method: 'GET', headers: undefined });
  });

  it('sends the CSRF token and the version on every state-changing call', async () => {
    const { api, calls } = client();
    await api.create({ title: 'N' }, 'tok');
    await api.update(campaign, 'tok');
    await api.launch('c1', 4, 'tok');
    await api.pause('c1', 5, 'tok');
    await api.resume('c1', 6, 'tok');
    await api.cancel('c1', 7, 'tok');
    await api.duplicate('c1', 'tok');
    await api.remove('c1', 'tok');
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/v1/campaigns'],
      ['PUT', '/api/v1/campaigns/c1'],
      ['POST', '/api/v1/campaigns/c1/launch'],
      ['POST', '/api/v1/campaigns/c1/pause'],
      ['POST', '/api/v1/campaigns/c1/resume'],
      ['POST', '/api/v1/campaigns/c1/cancel'],
      ['POST', '/api/v1/campaigns/c1/duplicate'],
      ['DELETE', '/api/v1/campaigns/c1'],
    ]);
    expect(calls.every((c) => c.headers?.['X-CSRF-Token'] === 'tok')).toBe(true);
    expect(calls.slice(2, 6).map((c) => c.body)).toEqual([
      { expectedVersion: 4 },
      { expectedVersion: 5 },
      { expectedVersion: 6 },
      { expectedVersion: 7 },
    ]);
  });

  it('turns a failed call into an ApiError with the API code', async () => {
    const failure = {
      response: {
        status: 422,
        headers: { get: () => null },
        _data: {
          error: { code: 'PREFLIGHT_FAILED', message: 'Not ready', details: { failed: ['title'] } },
        },
      },
    };
    const err = await client(failure, true)
      .api.launch('c1', 1, 'tok')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'PREFLIGHT_FAILED' });
  });
});

describe('messages and roles', () => {
  const err = (code: string) => new ApiError(400, code, 'x');

  it('has a specific line for each failure people can act on', () => {
    expect(campaignErrorKey(err('VERSION_CONFLICT'))).toBe('cmp.error.conflict');
    expect(campaignErrorKey(err('CAMPAIGN_LOCKED'))).toBe('cmp.error.locked');
    expect(campaignErrorKey(err('CAMPAIGN_STATE'))).toBe('cmp.error.state');
    expect(campaignErrorKey(err('PREFLIGHT_FAILED'))).toBe('cmp.error.checks');
    expect(campaignErrorKey(err('FORBIDDEN'))).toBe('cmp.error.forbidden');
    expect(campaignErrorKey(err('NETWORK'))).toBe('cmp.error.offline');
    expect(campaignErrorKey(err('SOMETHING_ELSE'))).toBe('cmp.error.generic');
  });

  it('offers actions only to the roles the server allows', () => {
    for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']) {
      expect([canManageCampaigns(role), canOperateCampaigns(role)]).toEqual([true, true]);
    }
    expect([
      canManageCampaigns('CAMPAIGN_OPERATOR'),
      canOperateCampaigns('CAMPAIGN_OPERATOR'),
    ]).toEqual([false, true]);
    for (const role of ['ANALYST', 'MODERATOR', '', undefined]) {
      expect([canManageCampaigns(role), canOperateCampaigns(role)]).toEqual([false, false]);
    }
  });
});

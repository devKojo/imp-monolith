// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../auth/api';
import { ApiError } from '../auth/errors';
import { createTemplatesApi, fromApi, toUpdateBody } from './api';
import { templateErrorKey } from './errors';
import { canManageTemplates } from './permissions';
import type { CampaignTemplate } from './types';

type Call = { url: string; method: string; body?: unknown; headers?: Record<string, string> };

const apiTemplate = {
  id: 't1',
  name: 'Entry',
  archetype: 'giveaway',
  status: 'DRAFT',
  version: 4,
  updatedAt: '2026-11-14T10:00:00.000Z',
  publishedAt: null,
  fields: [
    {
      id: 'f1',
      kind: 'email',
      key: 'email',
      label: 'Email',
      helper: '',
      required: true,
      options: [],
    },
  ],
};

function client(reply: unknown = apiTemplate, fails = false) {
  const calls: Call[] = [];
  const fetcher: Fetcher = async <T>(
    url: string,
    opts: { method: string; body?: unknown; headers?: Record<string, string> },
  ) => {
    calls.push({ url, ...opts });
    if (fails) throw reply;
    return reply as T;
  };
  return { api: createTemplatesApi(fetcher), calls };
}

describe('mapping', () => {
  it('reads the API template as a builder template', () => {
    expect(fromApi(apiTemplate as never)).toMatchObject({
      id: 't1',
      version: 4,
      blocks: [{ id: 'f1', key: 'email', kind: 'email', required: true }],
    });
  });

  it('sends the version that was read and no client-side ids', () => {
    const t = fromApi(apiTemplate as never);
    const body = toUpdateBody({ ...t, name: '  Entry  ' });
    expect(body).toMatchObject({ expectedVersion: 4, name: 'Entry', archetype: 'giveaway' });
    expect(body.fields[0]).not.toHaveProperty('id');
    expect(Object.keys(body.fields[0]!).sort()).toEqual(
      ['helper', 'key', 'kind', 'label', 'options', 'required'].sort(),
    );
  });

  it('only sends answers for a choice question', () => {
    const t: CampaignTemplate = {
      ...fromApi(apiTemplate as never),
      blocks: [
        {
          id: 'a',
          kind: 'text',
          key: 'a',
          label: 'A',
          helper: '',
          required: false,
          options: ['x'],
        },
        {
          id: 'b',
          kind: 'choice',
          key: 'b',
          label: 'B',
          helper: '',
          required: true,
          options: ['1', '2'],
        },
      ],
    };
    expect(toUpdateBody(t).fields.map((f) => f.options)).toEqual([[], ['1', '2']]);
  });
});

describe('client', () => {
  it('lists without a CSRF header', async () => {
    const { api, calls } = client({ items: [{ id: 't1' }] });
    expect(await api.list()).toEqual([{ id: 't1' }]);
    expect(calls[0]).toMatchObject({ url: '/api/v1/templates', method: 'GET', headers: undefined });
  });

  it('sends the CSRF token on every state-changing call', async () => {
    const { api, calls } = client();
    const t = fromApi(apiTemplate as never);
    await api.create({ name: 'N', archetype: 'quiz' }, 'tok');
    await api.update(t, 'tok');
    await api.publish('t1', 4, 'tok');
    await api.unpublish('t1', 5, 'tok');
    await api.duplicate('t1', 'tok');
    await api.remove('t1', 'tok');
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/v1/templates'],
      ['PUT', '/api/v1/templates/t1'],
      ['POST', '/api/v1/templates/t1/publish'],
      ['POST', '/api/v1/templates/t1/unpublish'],
      ['POST', '/api/v1/templates/t1/duplicate'],
      ['DELETE', '/api/v1/templates/t1'],
    ]);
    expect(calls.every((c) => c.headers?.['X-CSRF-Token'] === 'tok')).toBe(true);
    expect(calls[2]!.body).toEqual({ expectedVersion: 4 });
  });

  it('turns a failed call into an ApiError with the API code', async () => {
    const failure = {
      response: {
        status: 412,
        headers: { get: () => null },
        _data: { error: { code: 'VERSION_CONFLICT', message: 'The template changed' } },
      },
    };
    const { api } = client(failure, true);
    const err = await api.get('t1').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 412, code: 'VERSION_CONFLICT' });
  });
});

describe('messages and roles', () => {
  const err = (code: string) => new ApiError(400, code, 'x');

  it('has a specific line for each failure people can act on', () => {
    expect(templateErrorKey(err('VERSION_CONFLICT'))).toBe('tpl.error.conflict');
    expect(templateErrorKey(err('TEMPLATE_PUBLISHED'))).toBe('tpl.error.locked');
    expect(templateErrorKey(err('PREFLIGHT_FAILED'))).toBe('tpl.error.checks');
    expect(templateErrorKey(err('FORBIDDEN'))).toBe('tpl.error.forbidden');
    expect(templateErrorKey(err('NETWORK'))).toBe('tpl.error.offline');
    expect(templateErrorKey(err('SOMETHING_ELSE'))).toBe('tpl.error.generic');
  });

  it('offers changes only to the roles the server allows', () => {
    for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']) {
      expect(canManageTemplates(role)).toBe(true);
    }
    for (const role of ['CAMPAIGN_OPERATOR', 'ANALYST', 'MODERATOR', '', undefined]) {
      expect(canManageTemplates(role)).toBe(false);
    }
  });
});

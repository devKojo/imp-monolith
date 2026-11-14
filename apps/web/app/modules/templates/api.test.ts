// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../auth/api';
import { ApiError } from '../auth/errors';
import { createTemplatesApi } from './api';

describe('templates client', () => {
  it('reads the list of built-in types with a plain GET', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetcher: Fetcher = async <T>(url: string, opts: { method: string }) => {
      calls.push({ url, method: opts.method });
      return { items: [{ id: 't', slug: 'quiz' }] } as T;
    };
    const items = await createTemplatesApi(fetcher).list();
    expect(items).toEqual([{ id: 't', slug: 'quiz' }]);
    expect(calls).toEqual([{ url: '/api/v1/templates', method: 'GET' }]);
  });

  it('throws failures as ApiError', async () => {
    const fetcher: Fetcher = async () => {
      throw { statusCode: 403, data: { error: { code: 'FORBIDDEN', message: 'no' } } };
    };
    await expect(createTemplatesApi(fetcher).list()).rejects.toBeInstanceOf(ApiError);
  });
});

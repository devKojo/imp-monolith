import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { Campaign, CampaignSummary } from './types';

/** What a save sends: the version that was read, and the prizes without client-side ids. */
export const toUpdateBody = (c: Campaign) => ({
  expectedVersion: c.version,
  title: c.title.trim(),
  summary: c.summary,
  templateId: c.templateId,
  startAt: c.startAt,
  endAt: c.endAt,
  prizes: c.prizes.map(({ name, valueLabel, winners, description }) => ({
    name,
    valueLabel,
    winners,
    description,
  })),
});

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Same-origin client for /api/v1/campaigns. Cookies travel automatically (single origin, R-WEB-01);
 * every state-changing call carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown
 * as ApiError, like the auth client.
 */
export function createCampaignsApi(fetcher: Fetcher, base = '/api/v1/campaigns') {
  async function call<T>(
    method: Method,
    path: string,
    opts: { body?: unknown; csrf?: string } = {},
  ): Promise<T> {
    try {
      return await fetcher<T>(`${base}${path}`, {
        method,
        body: opts.body,
        headers: opts.csrf ? { 'X-CSRF-Token': opts.csrf } : undefined,
      });
    } catch (err) {
      throw toApiError(err);
    }
  }
  const act = (id: string, action: string, expectedVersion: number, csrf: string) =>
    call<Campaign>('POST', `/${id}/${action}`, { body: { expectedVersion }, csrf });

  return {
    list: async (): Promise<CampaignSummary[]> =>
      (await call<{ items: CampaignSummary[] }>('GET', '')).items,
    get: (id: string) => call<Campaign>('GET', `/${id}`),
    create: (input: { title: string; templateId?: string | null }, csrf: string) =>
      call<Campaign>('POST', '', { body: input, csrf }),
    update: (c: Campaign, csrf: string) =>
      call<Campaign>('PUT', `/${c.id}`, { body: toUpdateBody(c), csrf }),
    launch: (id: string, version: number, csrf: string) => act(id, 'launch', version, csrf),
    pause: (id: string, version: number, csrf: string) => act(id, 'pause', version, csrf),
    resume: (id: string, version: number, csrf: string) => act(id, 'resume', version, csrf),
    cancel: (id: string, version: number, csrf: string) => act(id, 'cancel', version, csrf),
    duplicate: (id: string, csrf: string, title?: string) =>
      call<Campaign>('POST', `/${id}/duplicate`, { body: title ? { title } : {}, csrf }),
    remove: (id: string, csrf: string) => call<void>('DELETE', `/${id}`, { csrf }),
  };
}

export type CampaignsApi = ReturnType<typeof createCampaignsApi>;

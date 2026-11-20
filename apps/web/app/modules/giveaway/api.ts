import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { PublicCampaignPage } from '../quiz/types';
import type { GiveawayInfo, GiveawayView } from './types';

type Method = 'GET' | 'POST';

/**
 * Same-origin client for the giveaway endpoints. Cookies travel automatically (single origin, R-WEB-01);
 * every state-changing call carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown as
 * ApiError, like the other clients.
 */
export function createGiveawayApi(fetcher: Fetcher, root = '/api/v1') {
  async function call<T>(
    method: Method,
    path: string,
    opts: { body?: unknown; csrf?: string } = {},
  ): Promise<T> {
    try {
      return await fetcher<T>(`${root}${path}`, {
        method,
        body: opts.body,
        headers: opts.csrf ? { 'X-CSRF-Token': opts.csrf } : undefined,
      });
    } catch (err) {
      throw toApiError(err);
    }
  }

  return {
    // Visitors: the public page and the facts.
    campaign: (slug: string) => call<PublicCampaignPage>('GET', `/public/campaigns/${slug}`),
    info: (slug: string) => call<GiveawayInfo>('GET', `/public/giveaway/${slug}`),

    // The participant: enter and read their own ticket.
    current: (slug: string) => call<GiveawayView>('GET', `/giveaway/${slug}`),
    enter: (slug: string, csrf: string) =>
      call<GiveawayView>('POST', `/giveaway/${slug}/entry`, { body: {}, csrf }),
  };
}

export type GiveawayApi = ReturnType<typeof createGiveawayApi>;

import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { BusinessAward, FulfilResult, PayoutDestination, SettleResult } from './types';

type Method = 'GET' | 'POST';

/**
 * Same-origin client for a business settling and paying out its rewards. Cookies travel automatically
 * (single origin, R-WEB-01); every change carries the session-bound X-CSRF-Token (R-IAM-02). Failures are
 * thrown as ApiError. The role is checked by the API; this client only asks.
 */
export function createBusinessRewardsApi(fetcher: Fetcher, root = '/api/v1/rewards') {
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
    awards: async (campaignId: string) =>
      (await call<{ items: BusinessAward[] }>('GET', `/campaigns/${campaignId}/awards`)).items,
    /** The awards as CSV text, with destinations masked. */
    exportCsv: (campaignId: string) =>
      call<string>('GET', `/campaigns/${campaignId}/awards/export`),
    settle: (campaignId: string, csrf: string) =>
      call<SettleResult>('POST', `/campaigns/${campaignId}/award`, { csrf }),
    destination: (awardId: string) =>
      call<PayoutDestination>('GET', `/awards/${awardId}/destination`),
    fulfil: (awardId: string, reference: string, csrf: string) =>
      call<FulfilResult>('POST', `/awards/${awardId}/fulfil`, { body: { reference }, csrf }),
  };
}

export type BusinessRewardsApi = ReturnType<typeof createBusinessRewardsApi>;

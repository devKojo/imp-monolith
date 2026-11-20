import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { ClaimInput, ClaimResult, MyAwardDetail, MyAwardsPage, WalletBalance } from './types';

type Method = 'GET' | 'POST';

/**
 * Same-origin client for a participant's own rewards. Cookies travel automatically (single origin,
 * R-WEB-01); claiming carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown as ApiError.
 */
export function createRewardsApi(fetcher: Fetcher, root = '/api/v1/my-rewards') {
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
    list: (limit = 50, offset = 0) => call<MyAwardsPage>('GET', `?limit=${limit}&offset=${offset}`),
    wallet: () => call<{ items: WalletBalance[] }>('GET', '/wallet'),
    get: (id: string) => call<MyAwardDetail>('GET', `/${id}`),
    claim: (id: string, input: ClaimInput, csrf: string) =>
      call<ClaimResult>('POST', `/${id}/claim`, { body: input, csrf }),
  };
}

export type RewardsApi = ReturnType<typeof createRewardsApi>;

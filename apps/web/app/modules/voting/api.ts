import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { PublicCampaignPage } from '../quiz/types';
import type { BallotInfo, BallotView, CampaignResults } from './types';

type Method = 'GET' | 'POST';

/**
 * Same-origin client for the voting endpoints. Cookies travel automatically (single origin, R-WEB-01);
 * every state-changing call carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown as
 * ApiError, like the other clients.
 */
export function createVotingApi(fetcher: Fetcher, root = '/api/v1') {
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
    info: (slug: string) => call<BallotInfo>('GET', `/public/voting/${slug}`),

    // The participant: read the options and vote.
    current: (slug: string) => call<BallotView>('GET', `/voting/${slug}`),
    cast: (slug: string, optionIndex: number, csrf: string) =>
      call<BallotView>('POST', `/voting/${slug}/vote`, { body: { optionIndex }, csrf }),

    // The business: how one of its campaigns stands.
    results: (campaignId: string) =>
      call<CampaignResults>('GET', `/voting/campaigns/${campaignId}/results`),
  };
}

export type VotingApi = ReturnType<typeof createVotingApi>;

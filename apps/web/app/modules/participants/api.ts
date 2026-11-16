import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type {
  BusinessActivity,
  CampaignActivity,
  ParticipantSummary,
  ParticipationFilter,
  ParticipationPage,
} from './types';

/** Rows asked for at a time; the API allows up to 100. */
export const PAGE_SIZE = 25;

/**
 * Same-origin client for /api/v1/participants (read-only). Cookies travel automatically (single origin,
 * R-WEB-01). Failures are thrown as ApiError, like the other clients.
 */
export function createParticipantsApi(fetcher: Fetcher, base = '/api/v1/participants') {
  async function get<T>(path: string, query?: Record<string, string | number>): Promise<T> {
    try {
      const qs = query
        ? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`
        : '';
      return await fetcher<T>(`${base}${path}${qs}`, { method: 'GET' });
    } catch (err) {
      throw toApiError(err);
    }
  }

  return {
    summary: () => get<ParticipantSummary>('/summary'),
    activity: () => get<BusinessActivity>('/activity'),
    campaign: (id: string) => get<CampaignActivity>(`/campaigns/${id}`),
    list: (filter: ParticipationFilter, offset = 0, limit = PAGE_SIZE) =>
      get<ParticipationPage>('', {
        limit,
        offset,
        ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
        ...(filter.status !== 'all' ? { status: filter.status } : {}),
      }),
  };
}

export type ParticipantsApi = ReturnType<typeof createParticipantsApi>;

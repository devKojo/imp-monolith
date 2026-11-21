import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { Decision, ReportPage, ReportStatus, ReviewPage } from './types';

type Method = 'GET' | 'POST';

/**
 * Same-origin client for platform review. Cookies travel automatically (single origin, R-WEB-01); every change
 * carries the session-bound X-CSRF-Token (R-IAM-02). Failures are thrown as ApiError. Who may use it is decided
 * by the API on every call; this client only asks.
 */
export function createPlatformApi(fetcher: Fetcher, root = '/api/v1/platform') {
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
    me: () => call<{ staff: true }>('GET', '/me'),
    reviews: (limit = 20, offset = 0) =>
      call<ReviewPage>('GET', `/reviews?limit=${limit}&offset=${offset}`),
    reports: (status: ReportStatus, limit = 20, offset = 0) =>
      call<ReportPage>('GET', `/reports?status=${status}&limit=${limit}&offset=${offset}`),
    decide: (
      awardId: string,
      input: { decision: Decision; note: string; password: string },
      csrf: string,
    ) =>
      call<{ awardId: string; status: string }>('POST', `/awards/${awardId}/decision`, {
        body: input,
        csrf,
      }),
    resolve: (
      reportId: string,
      input: { status: 'REVIEWED' | 'DISMISSED'; note: string },
      csrf: string,
    ) =>
      call<{ reportId: string; status: string }>('POST', `/reports/${reportId}/resolve`, {
        body: input,
        csrf,
      }),
  };
}

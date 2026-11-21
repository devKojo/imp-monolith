import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import type { Fetcher } from '../auth/api';
import { createPlatformApi } from './api';
import type { Decision, ReportStatus } from './types';

/**
 * Platform review for signed-in platform staff. Client-side only. A 401 means the session ended, so the person
 * is sent to sign in; a 403 means they are not staff, which the page shows as such.
 */
export function usePlatform() {
  const auth = useAuth();
  const api = createPlatformApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
  const csrf = () => auth.session.value?.csrfToken ?? '';

  async function run<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 401) {
        auth.session.value = null;
        await navigateTo(SIGNIN.business);
      }
      throw err;
    }
  }

  return {
    me: () => run(() => api.me()),
    reviews: (limit?: number, offset?: number) => run(() => api.reviews(limit, offset)),
    reports: (status: ReportStatus, limit?: number, offset?: number) =>
      run(() => api.reports(status, limit, offset)),
    decide: (awardId: string, input: { decision: Decision; note: string; password: string }) =>
      run(() => api.decide(awardId, input, csrf())),
    resolve: (reportId: string, input: { status: 'REVIEWED' | 'DISMISSED'; note: string }) =>
      run(() => api.resolve(reportId, input, csrf())),
  };
}

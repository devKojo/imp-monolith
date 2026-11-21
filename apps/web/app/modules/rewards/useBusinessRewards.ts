import { computed } from 'vue';
import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import type { Fetcher } from '../auth/api';
import { createBusinessRewardsApi } from './businessApi';
import { canManageRewards } from './businessLogic';
import type { RejectReason, ReviewDecision } from './types';

/**
 * Settling and paying out rewards for the signed-in business. Client-side only (the console is not
 * server-rendered). A 401 means the session ended, so the person is sent to sign in.
 */
export function useBusinessRewards() {
  const auth = useAuth();
  const api = createBusinessRewardsApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
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
    canManage: computed(() => canManageRewards(auth.session.value?.active?.role)),
    awards: (campaignId: string) => run(() => api.awards(campaignId)),
    exportCsv: (campaignId: string) => run(() => api.exportCsv(campaignId)),
    settle: (campaignId: string) => run(() => api.settle(campaignId, csrf())),
    destination: (awardId: string) => run(() => api.destination(awardId)),
    review: (awardId: string, decision: ReviewDecision, reason?: RejectReason) =>
      run(() => api.review(awardId, decision, reason, csrf())),
    fulfil: (awardId: string, reference: string) =>
      run(() => api.fulfil(awardId, reference, csrf())),
  };
}

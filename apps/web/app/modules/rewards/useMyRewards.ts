import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import type { Fetcher } from '../auth/api';
import { createRewardsApi } from './api';
import type { ClaimInput, MyAwardsPage, WalletBalance } from './types';

/**
 * A participant's rewards and wallet, and claiming. Client-side only (the page is client-rendered and
 * holds personal data). A 401 means the session ended, so the person is sent to sign in and back.
 */
export function useMyRewards() {
  const auth = useAuth();
  const api = createRewardsApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
  const csrf = () => auth.session.value?.csrfToken ?? '';

  async function run<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 401) {
        auth.session.value = null;
        await navigateTo({ path: SIGNIN.participant, query: { next: useRoute().fullPath } });
      }
      throw err;
    }
  }

  const awards = useAsyncData<MyAwardsPage>('participant:awards', () => run(() => api.list()), {
    server: false,
    default: () => ({ items: [], total: 0 }),
  });
  const wallet = useAsyncData<WalletBalance[]>(
    'participant:wallet',
    async () => (await run(() => api.wallet())).items,
    { server: false, default: () => [] },
  );

  return {
    awards,
    wallet,
    claim: (id: string, input: ClaimInput) => run(() => api.claim(id, input, csrf())),
    refresh: () => Promise.all([awards.refresh(), wallet.refresh()]),
  };
}

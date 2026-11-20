import type { Fetcher } from '../auth/api';
import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import { createGiveawayApi } from './api';

/**
 * The giveaway endpoints with the session's CSRF token. Client-side only. A 401 means the session ended, so
 * the person is sent to sign in (and back here afterwards) instead of seeing a broken page.
 */
export function useGiveaway() {
  const auth = useAuth();
  const api = createGiveawayApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
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

  return {
    // Public reads: no sign-in needed, so a 401 is not expected and is not redirected.
    campaign: (slug: string) => api.campaign(slug),
    info: (slug: string) => api.info(slug),
    current: (slug: string) => run(() => api.current(slug)),
    enter: (slug: string) => run(() => api.enter(slug, csrf())),
  };
}

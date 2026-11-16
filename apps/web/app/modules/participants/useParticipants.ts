import { computed } from 'vue';
import type { Fetcher } from '../auth/api';
import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import { createParticipantsApi } from './api';
import { canViewParticipants } from './permissions';

/**
 * Participants for the signed-in business, from the API. Client-side only (the console is not
 * server-rendered). A 401 means the session ended, so the person is sent to sign in.
 */
export function useParticipants() {
  const auth = useAuth();
  const api = createParticipantsApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);

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
    /** Whether the active role may see participants (the server still decides). */
    canView: computed(() => canViewParticipants(auth.session.value?.active?.role)),
    summary: () => run(() => api.summary()),
    campaign: (id: string) => run(() => api.campaign(id)),
    list: (...args: Parameters<typeof api.list>) => run(() => api.list(...args)),
  };
}

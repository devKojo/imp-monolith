import { computed } from 'vue';
import type { Fetcher } from '../auth/api';
import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import { createTemplatesApi } from './api';
import { canManageTemplates } from './permissions';
import type { Archetype, CampaignTemplate } from './types';

/**
 * Templates for the signed-in business, from the API. Client-side only (the console is not
 * server-rendered). The CSRF token comes from the session; a 401 means the session ended, so the
 * person is sent to sign in instead of seeing a broken page.
 */
export function useTemplates() {
  const auth = useAuth();
  const api = createTemplatesApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
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
    /** Whether the active role may change templates (the server still decides). */
    canManage: computed(() => canManageTemplates(auth.session.value?.active?.role)),
    list: () => run(() => api.list()),
    get: (id: string) => run(() => api.get(id)),
    create: (name: string, archetype: Archetype) =>
      run(() => api.create({ name, archetype }, csrf())),
    save: (t: CampaignTemplate) => run(() => api.update(t, csrf())),
    publish: (t: CampaignTemplate) => run(() => api.publish(t.id, t.version, csrf())),
    unpublish: (t: CampaignTemplate) => run(() => api.unpublish(t.id, t.version, csrf())),
    duplicate: (id: string) => run(() => api.duplicate(id, csrf())),
    remove: (id: string) => run(() => api.remove(id, csrf())),
  };
}

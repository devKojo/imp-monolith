import { computed } from 'vue';
import type { Fetcher } from '../auth/api';
import { useAuth } from '../auth/composables/useAuth';
import { SIGNIN } from '../auth/constants';
import { toApiError } from '../auth/errors';
import { createCampaignsApi } from './api';
import { canManageCampaigns, canOperateCampaigns } from './permissions';
import type { Campaign } from './types';

/**
 * Campaigns for the signed-in business, from the API. Client-side only (the console is not
 * server-rendered). The CSRF token comes from the session; a 401 means the session ended, so the
 * person is sent to sign in instead of seeing a broken page.
 */
export function useCampaigns() {
  const auth = useAuth();
  const api = createCampaignsApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
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

  const role = () => auth.session.value?.active?.role;
  return {
    /** Whether the active role may change campaigns (the server still decides). */
    canManage: computed(() => canManageCampaigns(role())),
    /** Whether the active role may pause and resume (the server still decides). */
    canOperate: computed(() => canOperateCampaigns(role())),
    list: () => run(() => api.list()),
    get: (id: string) => run(() => api.get(id)),
    create: (title: string, templateId?: string | null) =>
      run(() => api.create({ title, templateId: templateId ?? null }, csrf())),
    save: (c: Campaign) => run(() => api.update(c, csrf())),
    launch: (c: Campaign) => run(() => api.launch(c.id, c.version, csrf())),
    pause: (c: { id: string; version: number }) => run(() => api.pause(c.id, c.version, csrf())),
    resume: (c: { id: string; version: number }) => run(() => api.resume(c.id, c.version, csrf())),
    cancel: (c: Campaign) => run(() => api.cancel(c.id, c.version, csrf())),
    duplicate: (id: string) => run(() => api.duplicate(id, csrf())),
    remove: (id: string) => run(() => api.remove(id, csrf())),
  };
}

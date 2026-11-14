import type { Fetcher } from '../auth/api';
import { toApiError } from '../auth/errors';
import type { TemplateRef } from '../campaigns/types';

/**
 * The built-in campaign types, read-only: a business picks one for a campaign and then writes the content
 * itself. They are the same for everyone, so there is no create, edit or delete here.
 */
export function createTemplatesApi(fetcher: Fetcher, base = '/api/v1/templates') {
  return {
    list: async (): Promise<TemplateRef[]> => {
      try {
        return (await fetcher<{ items: TemplateRef[] }>(base, { method: 'GET' })).items;
      } catch (err) {
        throw toApiError(err);
      }
    },
  };
}

export type TemplatesApi = ReturnType<typeof createTemplatesApi>;

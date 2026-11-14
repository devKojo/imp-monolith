import type { Fetcher } from '../auth/api';
import { createTemplatesApi } from './api';

/** The built-in campaign types, from the API. Client-side only. */
export function useTemplates() {
  const api = createTemplatesApi(((url, opts) => $fetch(url, opts as never)) as Fetcher);
  return { list: () => api.list() };
}

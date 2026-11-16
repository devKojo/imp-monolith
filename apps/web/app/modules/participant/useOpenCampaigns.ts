import { createApiSource, type JsonFetcher } from '../discovery/source';
import { sortByEnding } from '../discovery/logic';
import { EMPTY_QUERY, type DiscoveryCampaign } from '../discovery/types';

/** Most campaigns shown in the participant carousel; the rest are one click away in Discover. */
export const CAROUSEL_LIMIT = 6;

/**
 * The campaigns open right now, soonest to close first, from the public listing. The hub is
 * client-rendered, so this loads in the browser only; a failed load is reported, never hidden.
 */
export function useOpenCampaigns() {
  const source = createApiSource(((url, opts) => $fetch(url, opts as never)) as JsonFetcher);
  const now = ref(Date.now());

  const { data, pending, error, refresh } = useAsyncData<DiscoveryCampaign[]>(
    'participant:open-campaigns',
    async () => {
      now.value = Date.now();
      return sortByEnding(await source.list(EMPTY_QUERY)).slice(0, CAROUSEL_LIMIT);
    },
    { server: false, default: () => [] },
  );

  return { campaigns: data, pending, error, refresh, now };
}

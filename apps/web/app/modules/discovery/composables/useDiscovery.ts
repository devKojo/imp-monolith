import { computed } from 'vue';
import { createApiSource, createSampleSource, type JsonFetcher } from '../source';
import { isCampaignType, type DiscoveryCampaign, type DiscoveryQuery } from '../types';

/**
 * Discovery data for the public listing. The search text and type filter live in the URL
 * (?q=&type=) so a filtered view can be shared and survives a reload. `now` is captured once in
 * useState so the server-rendered "time left" text matches what the client renders (no hydration
 * mismatch). No cookies or per-user data are involved: the page is edge-cacheable (R-WEB-05).
 */
export function useDiscovery() {
  const route = useRoute();
  const router = useRouter();
  const { public: config } = useRuntimeConfig();
  const now = useState<number>('discover:now', () => Date.now());

  const query = computed<DiscoveryQuery>(() => ({
    q: typeof route.query.q === 'string' ? route.query.q : '',
    type: isCampaignType(route.query.type) ? route.query.type : 'all',
  }));

  const source =
    config.discoverySource === 'api'
      ? createApiSource(((url, opts) => $fetch(url, opts as never)) as JsonFetcher)
      : createSampleSource(now.value);

  const { data, pending, error, refresh } = useAsyncData<DiscoveryCampaign[]>(
    'discover',
    () => source.list(query.value),
    { watch: [query], default: () => [] },
  );

  function setQuery(patch: Partial<DiscoveryQuery>) {
    const next = { ...query.value, ...patch };
    return router.replace({
      query: {
        ...route.query,
        q: next.q.trim() || undefined,
        type: next.type === 'all' ? undefined : next.type,
      },
    });
  }

  return {
    query,
    campaigns: data,
    pending,
    error,
    refresh,
    setQuery,
    clear: () => setQuery({ q: '', type: 'all' }),
    now,
    isSample: source.isSample,
  };
}

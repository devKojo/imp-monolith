import { isCampaignType, type DiscoveryCampaign, type DiscoveryQuery } from './types';

/** Anything that can fetch JSON; $fetch in the app, a stub in tests. */
export type JsonFetcher = <T>(url: string, opts?: { query?: Record<string, string> }) => Promise<T>;

export type DiscoverySource = {
  list(query: DiscoveryQuery): Promise<DiscoveryCampaign[]>;
};

/** Most pages followed for one listing, so a runaway cursor can never loop forever. */
export const MAX_PAGES = 10;

/**
 * The real source: GET /api/v1/public/campaigns?q=&type=&cursor= returning
 * `{ items, nextCursor }` (docs/frontend/discovery-contract.md). It follows the cursor so a long list
 * is not silently cut at the first page. Unknown campaign types are dropped so a newer server cannot
 * break an older client (consumers parse tolerantly, R-EVT-11 style).
 */
export function createApiSource(
  fetcher: JsonFetcher,
  base = '/api/v1/public/campaigns',
): DiscoverySource {
  return {
    list: async (query) => {
      const params: Record<string, string> = {};
      if (query.q.trim()) params.q = query.q.trim();
      if (query.type !== 'all') params.type = query.type;

      const items: DiscoveryCampaign[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res: { items?: DiscoveryCampaign[]; nextCursor?: string | null } = await fetcher(
          base,
          {
            query: cursor ? { ...params, cursor } : params,
          },
        );
        items.push(...(res.items ?? []).filter((c) => isCampaignType(c.type)));
        cursor = res.nextCursor ?? null;
        if (!cursor) break;
      }
      return items;
    },
  };
}

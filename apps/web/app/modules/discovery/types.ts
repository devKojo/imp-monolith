/**
 * Public campaign discovery. The architecture spec's endpoint catalogue has no listing endpoint yet
 * (only GET /public/campaigns/:slug), so this is the contract the UI needs; see
 * docs/frontend/discovery-contract.md. Items hold identifiers and public content only: no
 * participant data, no per-user fields (the response is edge-cached, R-WEB-05).
 */
export const CAMPAIGN_TYPES = ['quiz', 'poll', 'survey', 'vote', 'giveaway'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export type DiscoveryCampaign = {
  id: string;
  /** Public slug: the campaign page is /c/{slug}. */
  slug: string;
  title: string;
  summary: string;
  businessName: string;
  type: CampaignType;
  /** ISO 8601 instant when the campaign closes. */
  endsAt: string;
  /** IANA zone of the campaign, used to show the end time with its zone abbreviation. */
  timeZone: string;
  prize?: { label?: string; value: string };
  imageUrl?: string;
  imageAlt?: string;
};

export type DiscoveryQuery = { q: string; type: CampaignType | 'all' };

export const EMPTY_QUERY: DiscoveryQuery = { q: '', type: 'all' };

export const isCampaignType = (v: unknown): v is CampaignType =>
  typeof v === 'string' && (CAMPAIGN_TYPES as readonly string[]).includes(v);

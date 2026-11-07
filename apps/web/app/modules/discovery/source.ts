import { filterCampaigns, sortByEnding } from './logic';
import { isCampaignType, type DiscoveryCampaign, type DiscoveryQuery } from './types';

const HOUR = 3_600_000;

/**
 * Example campaigns for development, with end times relative to `nowMs`. All businesses are
 * fictional. The page labels this data as a sample so it is never mistaken for live campaigns.
 */
export function sampleCampaigns(nowMs: number): DiscoveryCampaign[] {
  const at = (hours: number) => new Date(nowMs + hours * HOUR).toISOString();
  return [
    {
      id: '0197a000-0000-7000-8000-000000000001',
      slug: 'black-friday-quiz',
      title: 'Black Friday Quiz',
      summary: 'Answer five questions about Ghana for a chance to win a weekend getaway for two.',
      businessName: 'Savanna Travel',
      type: 'quiz',
      endsAt: at(62),
      timeZone: 'Africa/Accra',
      prize: { label: 'Prize', value: 'Weekend getaway' },
    },
    {
      id: '0197a000-0000-7000-8000-000000000002',
      slug: 'flavour-poll',
      title: 'Pick our next flavour',
      summary:
        'Vote for the soft drink flavour we launch next. Results are shown when voting closes.',
      businessName: 'Fizz Drinks',
      type: 'poll',
      endsAt: at(20),
      timeZone: 'Africa/Accra',
    },
    {
      id: '0197a000-0000-7000-8000-000000000003',
      slug: 'coffee-month-giveaway',
      title: 'A year of coffee',
      summary: 'Enter once for a chance to win a free bag of beans every month for a year.',
      businessName: 'Volta Coffee',
      type: 'giveaway',
      endsAt: at(120),
      timeZone: 'Africa/Accra',
      prize: { label: 'Prize', value: '12 bags of coffee' },
    },
    {
      id: '0197a000-0000-7000-8000-000000000004',
      slug: 'reader-survey',
      title: 'Tell us what you read',
      summary:
        'A five-minute survey about your reading habits. Everyone who finishes can enter the draw.',
      businessName: 'Accra Books',
      type: 'survey',
      endsAt: at(240),
      timeZone: 'Africa/Accra',
      prize: { label: 'Prize', value: 'GHS 300 book voucher' },
    },
    {
      id: '0197a000-0000-7000-8000-000000000005',
      slug: 'best-kente-design',
      title: 'Vote for the best kente design',
      summary: "Choose your favourite from this season's designs. One vote per verified number.",
      businessName: 'Kente Co.',
      type: 'vote',
      endsAt: at(7),
      timeZone: 'Africa/Accra',
    },
    {
      id: '0197a000-0000-7000-8000-000000000006',
      slug: 'ghana-trivia',
      title: 'Ghana trivia challenge',
      summary:
        'Ten quick questions. Top scorers win airtime bundles, with prizes claimed by one-time code.',
      businessName: 'Fizz Drinks',
      type: 'quiz',
      endsAt: at(300),
      timeZone: 'Africa/Accra',
      prize: { label: 'Prize', value: 'GHS 50 airtime' },
    },
    ...[
      [
        'Weekend brunch vote',
        'poll',
        'Pick the brunch special we serve next month.',
        'Osu Kitchen',
        30,
      ],
      [
        'Sneaker design quiz',
        'quiz',
        'Six questions on sneaker history. Top scorers win a store voucher.',
        'Kicks Lab',
        90,
        'GHS 200 voucher',
      ],
      [
        'Phone plan survey',
        'survey',
        'Tell us what you want from a mobile plan. Takes three minutes.',
        'Ghana Mobile',
        150,
        'GHS 100 data bundle',
      ],
      [
        'Mural of the year',
        'vote',
        'Vote for your favourite street mural in Accra.',
        'City Arts',
        48,
      ],
      [
        'Gym membership giveaway',
        'giveaway',
        'Enter once to win three months at a partner gym.',
        'FitHub',
        200,
        '3 months free',
      ],
      [
        'Cocoa trivia',
        'quiz',
        'How well do you know Ghana cocoa? Eight quick questions.',
        'Cocoa Co.',
        72,
        'Chocolate hamper',
      ],
      ['Radio jingle poll', 'poll', 'Which jingle should we air this season?', 'Joy Beats', 26],
      [
        'Travel habits survey',
        'survey',
        'Share how you travel and enter the draw.',
        'Voyage Co.',
        260,
        'GHS 250 voucher',
      ],
    ].map(([title, type, summary, businessName, hours, prize], i) => ({
      id: `0197a000-0000-7000-8000-0000000000${String(i + 7).padStart(2, '0')}`,
      slug: String(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      title: String(title),
      summary: String(summary),
      businessName: String(businessName),
      type: type as DiscoveryCampaign['type'],
      endsAt: at(Number(hours)),
      timeZone: 'Africa/Accra',
      ...(prize ? { prize: { label: 'Prize', value: String(prize) } } : {}),
    })),
  ];
}

/** Anything that can fetch JSON; $fetch in the app, a stub in tests. */
export type JsonFetcher = <T>(url: string, opts?: { query?: Record<string, string> }) => Promise<T>;

export type DiscoverySource = {
  list(query: DiscoveryQuery): Promise<DiscoveryCampaign[]>;
  /** True when the data is made up, so the page can say so. */
  readonly isSample: boolean;
};

/** Development source: filters the fixtures with the same logic the real endpoint should follow. */
export function createSampleSource(nowMs: number): DiscoverySource {
  return {
    isSample: true,
    list: async (query) => sortByEnding(filterCampaigns(sampleCampaigns(nowMs), query)),
  };
}

/**
 * Real source: GET /api/v1/public/campaigns?q=&type= returning `{ items: DiscoveryCampaign[] }`
 * (docs/frontend/discovery-contract.md). Unknown campaign types are dropped so a newer server
 * cannot break an older client (consumers parse tolerantly, R-EVT-11 style).
 */
export function createApiSource(
  fetcher: JsonFetcher,
  base = '/api/v1/public/campaigns',
): DiscoverySource {
  return {
    isSample: false,
    list: async (query) => {
      const params: Record<string, string> = {};
      if (query.q.trim()) params.q = query.q.trim();
      if (query.type !== 'all') params.type = query.type;
      const res = await fetcher<{ items?: DiscoveryCampaign[] }>(base, { query: params });
      return (res.items ?? []).filter((c) => isCampaignType(c.type));
    },
  };
}

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  countText,
  filterCampaigns,
  nextVisible,
  sortByEnding,
  timeLeftText,
} from './logic';
import { MAX_PAGES, createApiSource } from './source';
import { EMPTY_QUERY, type DiscoveryCampaign } from './types';

const NOW = Date.parse('2026-11-07T10:00:00Z');
const H = 3_600_000;
const iso = (hours: number) => new Date(NOW + hours * H).toISOString();

/** A few campaigns shaped like the API's response, for testing the filtering and the source. */
function fixtures(nowMs: number): DiscoveryCampaign[] {
  const at = (hours: number) => new Date(nowMs + hours * H).toISOString();
  const make = (
    n: number,
    type: DiscoveryCampaign['type'],
    title: string,
    businessName: string,
    hours: number,
    prize?: string,
  ): DiscoveryCampaign => ({
    id: `0197a000-0000-7000-8000-${String(n).padStart(12, '0')}`,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title,
    summary: `About ${title}`,
    businessName,
    type,
    endsAt: at(hours),
    timeZone: 'UTC',
    ...(prize ? { prize: { label: 'Prize', value: prize } } : {}),
  });
  return [
    make(1, 'quiz', 'Black Friday Quiz', 'Savanna Travel', 62, 'Weekend getaway'),
    make(2, 'giveaway', 'A year of coffee', 'Volta Coffee', 120, '12 bags of coffee'),
    make(3, 'survey', 'Tell us what you read', 'Accra Books', 240, 'GHS 300 book voucher'),
    make(4, 'quiz', 'Ghana trivia', 'Fizz Drinks', 300, 'GHS 50 airtime'),
    make(5, 'giveaway', 'Gym membership', 'FitHub', 200),
  ];
}

describe('timeLeftText (relative time, server and client agree)', () => {
  it.each([
    [-1, 'Ended'],
    [0, 'Ended'],
    [0.5, 'Ending soon'],
    [1, '1 hour left'],
    [5.9, '5 hours left'],
    [47, '47 hours left'],
    [48, '2 days left'],
    [24 * 10 + 3, '10 days left'],
  ])('%s hours -> %s', (hours, text) => {
    expect(timeLeftText(iso(hours), NOW)).toBe(text);
  });

  it('is a pure function of its inputs', () => {
    expect(timeLeftText(iso(100), NOW)).toBe(timeLeftText(iso(100), NOW));
  });
});

describe('countText', () => {
  it('handles singular and plural', () => {
    expect(countText(1)).toBe('1 campaign');
    expect(countText(0)).toBe('0 campaigns');
    expect(countText(6)).toBe('6 campaigns');
  });
});

describe('filterCampaigns', () => {
  const list = fixtures(NOW);

  it('returns everything for the empty query', () => {
    expect(filterCampaigns(list, EMPTY_QUERY)).toHaveLength(list.length);
  });

  it('filters by type', () => {
    const quizzes = filterCampaigns(list, { q: '', type: 'quiz' });
    expect(quizzes.length).toBeGreaterThan(0);
    expect(quizzes.every((c) => c.type === 'quiz')).toBe(true);
  });

  it('searches title, summary, business and prize case-insensitively', () => {
    expect(filterCampaigns(list, { q: 'COFFEE', type: 'all' }).map((c) => c.slug)).toContain(
      'a-year-of-coffee',
    );
    expect(filterCampaigns(list, { q: 'savanna', type: 'all' })).toHaveLength(1);
    expect(filterCampaigns(list, { q: 'airtime', type: 'all' })).toHaveLength(1);
    expect(filterCampaigns(list, { q: '  coffee  ', type: 'all' })).toHaveLength(1);
  });

  it('combines type and text, and can match nothing', () => {
    expect(filterCampaigns(list, { q: 'coffee', type: 'quiz' })).toEqual([]);
    expect(filterCampaigns(list, { q: 'zzzz', type: 'all' })).toEqual([]);
  });

  it('sorts soonest-ending first without mutating the input', () => {
    const copy = [...list];
    const sorted = sortByEnding(list);
    expect(list).toEqual(copy);
    const ends = sorted.map((c) => Date.parse(c.endsAt));
    expect(ends).toEqual([...ends].sort((a, b) => a - b));
  });
});

describe('createApiSource', () => {
  it('sends only the non-default filters and tolerates unknown types from a newer server', async () => {
    const seen: Array<{ url: string; query?: Record<string, string> }> = [];
    const source = createApiSource(async (url, opts) => {
      seen.push({ url, query: opts?.query });
      return {
        items: [{ ...fixtures(NOW)[0]!, type: 'hologram' as never }, fixtures(NOW)[1]!],
        nextCursor: null,
      } as never;
    });
    const items = await source.list({ q: ' quiz ', type: 'poll' });
    expect(seen[0]).toEqual({
      url: '/api/v1/public/campaigns',
      query: { q: 'quiz', type: 'poll' },
    });
    expect(items).toHaveLength(1);
    await source.list(EMPTY_QUERY);
    expect(seen[1]!.query).toEqual({});
  });

  it('follows the cursor until the server has no more, keeping the filters', async () => {
    const pages: Record<string, { items: DiscoveryCampaign[]; nextCursor: string | null }> = {
      '': { items: fixtures(NOW).slice(0, 2), nextCursor: 'c1' },
      c1: { items: fixtures(NOW).slice(2, 4), nextCursor: 'c2' },
      c2: { items: fixtures(NOW).slice(4), nextCursor: null },
    };
    const seen: Array<Record<string, string> | undefined> = [];
    const source = createApiSource((async (
      _url: string,
      opts?: { query?: Record<string, string> },
    ) => {
      seen.push(opts?.query);
      return pages[opts?.query?.cursor ?? ''];
    }) as never);
    const items = await source.list({ q: 'x', type: 'quiz' });
    expect(items.map((c) => c.id)).toEqual(fixtures(NOW).map((c) => c.id));
    expect(seen).toEqual([
      { q: 'x', type: 'quiz' },
      { q: 'x', type: 'quiz', cursor: 'c1' },
      { q: 'x', type: 'quiz', cursor: 'c2' },
    ]);
  });

  it('stops after a fixed number of pages even if the server keeps sending a cursor', async () => {
    let calls = 0;
    const source = createApiSource((async () => {
      calls += 1;
      return { items: [], nextCursor: 'again' };
    }) as never);
    await source.list(EMPTY_QUERY);
    expect(calls).toBe(MAX_PAGES);
  });

  it('copes with a missing items array', async () => {
    const source = createApiSource((async () => ({})) as never);
    expect(await source.list(EMPTY_QUERY)).toEqual([]);
  });
});

describe('paging', () => {
  it('reveals one page at a time and stops at the total', () => {
    expect(nextVisible(PAGE_SIZE, 20)).toBe(PAGE_SIZE * 2);
    expect(nextVisible(PAGE_SIZE * 2, 20)).toBe(20);
    expect(nextVisible(20, 20)).toBe(20);
  });
});

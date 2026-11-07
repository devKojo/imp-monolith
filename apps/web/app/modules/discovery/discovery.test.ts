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
import { createApiSource, createSampleSource, sampleCampaigns } from './source';
import { EMPTY_QUERY, isCampaignType } from './types';

const NOW = Date.parse('2026-11-07T10:00:00Z');
const H = 3_600_000;
const iso = (hours: number) => new Date(NOW + hours * H).toISOString();

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
  const list = sampleCampaigns(NOW);

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
      'coffee-month-giveaway',
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

describe('sample data', () => {
  it('is well-formed: uuids, unique slugs, valid types, future end times, an IANA zone', () => {
    const list = sampleCampaigns(NOW);
    expect(new Set(list.map((c) => c.slug)).size).toBe(list.length);
    for (const c of list) {
      expect(c.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(isCampaignType(c.type)).toBe(true);
      expect(Date.parse(c.endsAt)).toBeGreaterThan(NOW);
      expect(() => new Intl.DateTimeFormat('en', { timeZone: c.timeZone })).not.toThrow();
    }
  });

  it('is clearly marked as sample data so the page can say so', async () => {
    expect(createSampleSource(NOW).isSample).toBe(true);
    const sorted = await createSampleSource(NOW).list(EMPTY_QUERY);
    expect(sorted[0]!.slug).toBe('best-kente-design'); // ends first (7 hours)
  });
});

describe('createApiSource', () => {
  it('sends only the non-default filters and tolerates unknown types from a newer server', async () => {
    const seen: Array<{ url: string; query?: Record<string, string> }> = [];
    const source = createApiSource(async (url, opts) => {
      seen.push({ url, query: opts?.query });
      return {
        items: [
          { ...sampleCampaigns(NOW)[0]!, type: 'hologram' as never },
          sampleCampaigns(NOW)[1]!,
        ],
      } as never;
    });
    const items = await source.list({ q: ' quiz ', type: 'poll' });
    expect(seen[0]).toEqual({
      url: '/api/v1/public/campaigns',
      query: { q: 'quiz', type: 'poll' },
    });
    expect(items).toHaveLength(1);
    expect(source.isSample).toBe(false);
    await source.list(EMPTY_QUERY);
    expect(seen[1]!.query).toEqual({});
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

  it('has more sample campaigns than one page, with unique ids and slugs', () => {
    const all = sampleCampaigns(0);
    expect(all.length).toBeGreaterThan(PAGE_SIZE);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
  });
});

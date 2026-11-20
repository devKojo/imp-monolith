// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canEnter, isPublicNow, pageUrl, timeLeft, totalWinners } from './publicPage';

const NOW = new Date('2026-11-16T12:00:00Z');
const base = {
  slug: 'quiz-1',
  status: 'LIVE' as const,
  startAt: null,
  endAt: '2026-12-01T00:00:00Z',
};

describe('isPublicNow', () => {
  it('is open for a live campaign with an address and a future close', () => {
    expect(isPublicNow(base, NOW)).toBe(true);
  });
  it('is closed without an address, after the close, or while a draft, paused or ended', () => {
    expect(isPublicNow({ ...base, slug: null }, NOW)).toBe(false);
    expect(isPublicNow({ ...base, endAt: '2026-11-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isPublicNow({ ...base, endAt: null }, NOW)).toBe(false);
    for (const status of ['DRAFT', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(isPublicNow({ ...base, status }, NOW)).toBe(false);
    }
  });
  it('opens a scheduled campaign only once it has started', () => {
    const scheduled = { ...base, status: 'SCHEDULED' as const };
    expect(isPublicNow({ ...scheduled, startAt: '2026-11-20T00:00:00Z' }, NOW)).toBe(false);
    expect(isPublicNow({ ...scheduled, startAt: '2026-11-10T00:00:00Z' }, NOW)).toBe(true);
    expect(isPublicNow({ ...scheduled, startAt: null }, NOW)).toBe(false);
  });
});

describe('links', () => {
  it('builds the shareable address from the site origin', () => {
    expect(pageUrl('https://imp.example', 'quiz-1')).toBe('https://imp.example/c/quiz-1');
  });
});

describe('timeLeft', () => {
  it('splits the time into days, hours, minutes and seconds', () => {
    const end = new Date(NOW.getTime() + ((13 * 24 + 18) * 3600 + 42 * 60 + 19) * 1000);
    expect(timeLeft(end.toISOString(), NOW.getTime())).toEqual({
      days: 13,
      hours: 18,
      minutes: 42,
      seconds: 19,
    });
  });
  it('is null once the time has passed or the date is not valid', () => {
    expect(timeLeft('2026-11-16T12:00:00Z', NOW.getTime())).toBeNull();
    expect(timeLeft('not a date', NOW.getTime())).toBeNull();
  });
});

describe('prizes and entry', () => {
  it('adds up winners across tiers', () => {
    expect(totalWinners([{ winners: 1 }, { winners: 3 }, { winners: 50 }])).toBe(54);
    expect(totalWinners([])).toBe(0);
  });
  it('lets visitors enter every kind of campaign they can take part in', () => {
    for (const type of ['quiz', 'survey', 'poll', 'vote', 'giveaway']) {
      expect(canEnter(type)).toBe(true);
    }
    expect(canEnter('instant')).toBe(false);
  });
});

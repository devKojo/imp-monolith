import type { Campaign } from './types';

/** Pure helpers for a campaign's public page (/c/{slug}) and for the links to it. */

/** The part of a campaign that decides whether its public page is open. */
type Openable = Pick<Campaign, 'slug' | 'status' | 'startAt' | 'endAt'>;

/**
 * Whether the public page can be opened right now, mirroring the API: running (or scheduled and
 * already started), with an address and a closing time still ahead. The server still decides; this
 * only keeps the "view page" and "share" actions honest.
 */
export function isPublicNow(c: Openable, now: Date): boolean {
  if (!c.slug || !c.endAt || new Date(c.endAt) <= now) return false;
  if (c.status === 'LIVE') return true;
  return c.status === 'SCHEDULED' && c.startAt !== null && new Date(c.startAt) <= now;
}

export const pagePath = (slug: string): string => `/c/${slug}`;
export const pageUrl = (origin: string, slug: string): string => `${origin}${pagePath(slug)}`;

export type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

/** Whole days, hours, minutes and seconds until `endsAt`; null once it has passed (or is not a date). */
export function timeLeft(endsAt: string, nowMs: number): TimeLeft | null {
  const ms = new Date(endsAt).getTime() - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** What a campaign's prize tiers add up to, for the "N winners in total" line. */
export const totalWinners = (prizes: readonly { winners: number }[]): number =>
  prizes.reduce((sum, p) => sum + p.winners, 0);

/** Campaign types a visitor can actually enter today. */
export const canEnter = (type: string): boolean => type === 'quiz';

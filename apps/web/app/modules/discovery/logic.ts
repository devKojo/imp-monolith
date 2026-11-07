import { t } from '../../i18n';
import type { DiscoveryCampaign, DiscoveryQuery } from './types';

const HOUR = 3_600_000;

/**
 * Case-insensitive filter by type and free text over title, summary, business and prize. Used for
 * sample data and as the reference behaviour the real endpoint's `q` and `type` parameters follow.
 */
export function filterCampaigns(
  list: DiscoveryCampaign[],
  query: DiscoveryQuery,
): DiscoveryCampaign[] {
  const q = query.q.trim().toLowerCase();
  return list.filter((c) => {
    if (query.type !== 'all' && c.type !== query.type) return false;
    if (!q) return true;
    return [c.title, c.summary, c.businessName, c.prize?.value ?? '']
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

/** Soonest ending first, so what is about to close is seen first. */
export const sortByEnding = (list: DiscoveryCampaign[]): DiscoveryCampaign[] =>
  [...list].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));

/**
 * Relative time left. Always paired with the absolute end time in the UI (UI-CPY-04). `nowMs` is
 * passed in (not read from the clock) so server and client render the same text.
 */
export function timeLeftText(endsAtIso: string, nowMs: number): string {
  const ms = Date.parse(endsAtIso) - nowMs;
  if (ms <= 0) return t('time.ended');
  const hours = Math.floor(ms / HOUR);
  if (hours < 1) return t('time.left.soon');
  if (hours < 48) return hours === 1 ? t('time.left.hour') : t('time.left.hours', { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('time.left.day') : t('time.left.days', { n: days });
}

export const countText = (n: number): string =>
  n === 1 ? t('discover.count.one') : t('discover.count.other', { n });

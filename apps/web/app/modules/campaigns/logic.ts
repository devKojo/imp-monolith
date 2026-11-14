import { zonedToInstant } from '@imp/ui/app/utils/datetime';
import type { Campaign, PreflightCheck, Prize } from './types';

/** Pure helpers for the campaign builder: every function returns new data and never mutates. */

/** The API's limits, so the form stops people before the server has to. */
export const LIMITS = {
  title: 120,
  summary: 600,
  prizes: 10,
  prizeName: 120,
  prizeValue: 60,
  prizeDescription: 300,
  winners: 100_000,
} as const;

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const newPrize = (id: string): Prize => ({
  id,
  name: '',
  valueLabel: '',
  winners: 1,
  description: '',
});

export const addPrize = (prizes: readonly Prize[], prize: Prize): Prize[] => [...prizes, prize];

export const removePrize = (prizes: readonly Prize[], id: string): Prize[] =>
  prizes.filter((p) => p.id !== id);

export const updatePrize = (
  prizes: readonly Prize[],
  id: string,
  patch: Partial<Omit<Prize, 'id'>>,
): Prize[] => prizes.map((p) => (p.id === id ? { ...p, ...patch } : p));

export function movePrize(prizes: readonly Prize[], id: string, direction: -1 | 1): Prize[] {
  const from = prizes.findIndex((p) => p.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= prizes.length) return [...prizes];
  const next = [...prizes];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Whole prize count across tiers, for the "N winners" line. */
export const winnersLabelKey = (
  n: number,
): 'cmp.preview.winners.one' | 'cmp.preview.winners.other' =>
  n === 1 ? 'cmp.preview.winners.one' : 'cmp.preview.winners.other';

/**
 * The checks a campaign must pass to launch, mirrored from the server so the screen can guide people.
 * The server runs them again and has the last word.
 */
export function preflight(
  c: Pick<Campaign, 'title' | 'template' | 'startAt' | 'endAt' | 'prizes'>,
  now: Date,
): PreflightCheck[] {
  const needsPrizes = c.template !== null && ['giveaway', 'instant'].includes(c.template.archetype);
  const prizesComplete = c.prizes.every((p) => p.name.trim() !== '' && p.winners >= 1);
  const start = c.startAt ? new Date(c.startAt) : null;
  const end = c.endAt ? new Date(c.endAt) : null;
  return [
    { id: 'title', pass: c.title.trim() !== '' },
    { id: 'template', pass: c.template !== null && c.template.status === 'PUBLISHED' },
    { id: 'schedule', pass: end !== null && end > now && (start === null || start < end) },
    { id: 'prizes', pass: prizesComplete && (!needsPrizes || c.prizes.length > 0) },
  ];
}

export const isLaunchable = (
  c: Pick<Campaign, 'title' | 'template' | 'startAt' | 'endAt' | 'prizes'>,
  now: Date,
): boolean => preflight(c, now).every((p) => p.pass);

/** The wall-clock date and time of an instant in a zone, for the date and time fields. */
export type DateParts = { date: string; time: string; zone: string };

export function toParts(iso: string | null, zone: string): DateParts {
  if (!iso) return { date: '', time: '', zone };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
    zone,
  };
}

/** The instant (ISO) for a date, time and zone, or null while any of them is empty or invalid. */
export function fromParts(p: DateParts): string | null {
  if (!p.date || !p.time) return null;
  const instant = zonedToInstant(p.date, p.time, p.zone);
  return instant && !Number.isNaN(instant.getTime()) ? instant.toISOString() : null;
}

/** The viewer's own zone, so a new schedule starts in the zone they are in. */
export const browserZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

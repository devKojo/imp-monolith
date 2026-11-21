import { amountText, parseAmount, POOL_CURRENCIES } from './pool';
import type { Prize, PrizeKind } from './types';

/**
 * The reward settings of a prize: what it is worth (cash or points) and which places it covers. Mirrors the
 * API's rules, which still decide; this only helps while typing.
 */

export const PRIZE_KINDS: PrizeKind[] = ['ITEM', 'CASH', 'POINTS'];

/** Prizes are cash or points; the pool helpers call cash "money". */
const unit = (kind: PrizeKind) => (kind === 'CASH' ? ('MONEY' as const) : ('POINTS' as const));

/** The kind changed: what the amount meant no longer holds, so it and the currency start again. */
export function withKind(kind: PrizeKind): Partial<Prize> {
  return {
    kind,
    amountMinor: null,
    currency: kind === 'CASH' ? (POOL_CURRENCIES[0] as string) : null,
  };
}

/** The amount as typed (major units for cash, a count for points) as a patch; null while it is not valid. */
export function amountPatch(prize: Pick<Prize, 'kind' | 'currency'>, text: string): Partial<Prize> {
  const kind = prize.kind ?? 'ITEM';
  if (kind === 'ITEM') return { amountMinor: null };
  return { amountMinor: parseAmount(text, { kind: unit(kind), currency: prize.currency ?? null }) };
}

/** A currency changed: the typed amount is read again, since minor units differ between currencies. */
export function currencyPatch(currency: string, text: string): Partial<Prize> {
  return { currency, amountMinor: parseAmount(text, { kind: 'MONEY', currency }) };
}

/** The stored amount as it is typed. */
export function amountInput(prize: Pick<Prize, 'kind' | 'currency' | 'amountMinor'>): string {
  const kind = prize.kind ?? 'ITEM';
  if (kind === 'ITEM' || !prize.amountMinor) return '';
  return amountText({
    kind: unit(kind),
    currency: prize.currency ?? null,
    amount: prize.amountMinor,
  });
}

/** A whole number from 1 as a patch value, or null when empty or not valid. */
export function placeOf(text: string): number | null {
  const n = Number(text);
  return text.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null;
}

export type PrizeRewardProblem = 'amount' | 'place' | 'count' | null;

/** What to fix on a prize's reward settings, in the order a person would fix it. */
export function rewardProblem(p: Prize): PrizeRewardProblem {
  const kind = p.kind ?? 'ITEM';
  if (kind !== 'ITEM' && !p.amountMinor) return 'amount';
  const from = p.rankFrom ?? null;
  const to = p.rankTo ?? null;
  if (from === null && to === null) return null;
  if (from === null || to === null || to < from) return 'place';
  return to - from + 1 === p.winners ? null : 'count';
}

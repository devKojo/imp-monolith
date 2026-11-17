import type { PoolKind, PrizePool } from './types';

/** Prize pools: one amount shared equally by a limited number of participants (mirrors the API's rules). */

export const POOL_CURRENCIES = [
  'GHS',
  'NGN',
  'KES',
  'ZAR',
  'UGX',
  'TZS',
  'RWF',
  'XOF',
  'EGP',
  'MAD',
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'INR',
] as const;

export const POOL_LIMITS = { amountMax: 1_000_000_000_000, participantsMax: 1_000_000 } as const;

/** Minor units per major unit: money is stored as a whole number of the smallest unit. */
const WHOLE_CURRENCIES = new Set(['UGX', 'RWF', 'XOF']);
export const minorFactor = (currency: string | null): number =>
  currency && WHOLE_CURRENCIES.has(currency) ? 1 : 100;

/** A pool as a new one starts: money in the first currency, with nothing entered yet. */
export const newPool = (kind: PoolKind = 'POINTS'): PrizePool => ({
  kind,
  amount: 0,
  currency: kind === 'MONEY' ? 'GHS' : null,
  maxParticipants: 0,
});

/** The same pool in another unit: money needs a currency, points have none. */
export const withKind = (pool: PrizePool, kind: PoolKind): PrizePool => ({
  ...pool,
  kind,
  currency: kind === 'MONEY' ? (pool.currency ?? 'GHS') : null,
});

/** The amount typed (points, or major units such as "5000.50") as the stored whole number; null if it is not one. */
export function parseAmount(
  text: string,
  pool: Pick<PrizePool, 'kind' | 'currency'>,
): number | null {
  const clean = text.trim().replace(/,/g, '');
  if (clean === '') return null;
  // Money in a currency with minor units takes up to two decimals; points and whole-unit currencies none.
  const decimals = pool.kind === 'MONEY' && minorFactor(pool.currency) > 1;
  if (!(decimals ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(clean)) return null;
  const n = Math.round(Number(clean) * (pool.kind === 'MONEY' ? minorFactor(pool.currency) : 1));
  return Number.isSafeInteger(n) && n <= POOL_LIMITS.amountMax ? n : null;
}

/** The stored amount as it is typed: points as they are, money in major units without trailing noise. */
export function amountText(pool: Pick<PrizePool, 'kind' | 'currency' | 'amount'>): string {
  if (pool.amount === 0) return '';
  if (pool.kind === 'POINTS') return String(pool.amount);
  const factor = minorFactor(pool.currency);
  return factor === 1
    ? String(pool.amount)
    : (pool.amount / factor).toFixed(2).replace(/\.00$/, '');
}

/** Each seat's equal share, and what cannot be split evenly. */
export function poolShare(pool: Pick<PrizePool, 'amount' | 'maxParticipants'>) {
  if (pool.maxParticipants < 1) return { share: 0, remainder: pool.amount };
  const share = Math.floor(pool.amount / pool.maxParticipants);
  return { share, remainder: pool.amount - share * pool.maxParticipants };
}

export type PoolProblem = 'amount' | 'participants' | 'currency' | 'small';

/** What is missing or wrong with the pool, or null. Mirrors the API, which decides at launch. */
export function poolProblem(pool: PrizePool): PoolProblem | null {
  if (!Number.isInteger(pool.amount) || pool.amount < 1 || pool.amount > POOL_LIMITS.amountMax) {
    return 'amount';
  }
  if (
    !Number.isInteger(pool.maxParticipants) ||
    pool.maxParticipants < 1 ||
    pool.maxParticipants > POOL_LIMITS.participantsMax
  ) {
    return 'participants';
  }
  if (pool.kind === 'MONEY' && !pool.currency) return 'currency';
  if (poolShare(pool).share < 1) return 'small';
  return null;
}

/** An amount as people read it: "GH₵ 5,000.00" or "10,000 points". */
export function formatAmount(
  pool: Pick<PrizePool, 'kind' | 'currency'>,
  amount: number,
  locale = 'en',
): string {
  if (pool.kind === 'POINTS' || !pool.currency) {
    return `${new Intl.NumberFormat(locale).format(amount)} points`;
  }
  const factor = minorFactor(pool.currency);
  const digits = factor === 1 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: pool.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / factor);
}

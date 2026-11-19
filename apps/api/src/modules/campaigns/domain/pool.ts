/**
 * A prize pool: one amount shared by a limited number of participants, instead of prize tiers with
 * winners. Pure rules, no I/O.
 *
 * Every seat has the same share, so a participant knows what they will receive before they join:
 * `share = floor(amount / maxParticipants)`. The campaign takes at most `maxParticipants` people and
 * closes the moment the last seat is taken, which is also the moment the pool is fully allocated. If it
 * ends on its date with seats left, the shares of the empty seats are simply not paid out.
 */

export const POOL_KINDS = ['POINTS', 'MONEY'] as const;
export type PoolKind = (typeof POOL_KINDS)[number];

/** Currencies a business can offer. Amounts are whole minor units (pesewas, cents, kobo): never fractions. */
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
export type PoolCurrency = (typeof POOL_CURRENCIES)[number];

/** Minor units per major unit. Money here is stored as an integer of the smallest unit. */
const MINOR_FACTOR: Record<string, number> = { UGX: 1, RWF: 1, XOF: 1 };
export const minorFactor = (currency: string): number => MINOR_FACTOR[currency] ?? 100;

export const POOL_LIMITS = {
  /** Largest amount (points, or minor units) a pool may hold: well inside a safe integer. */
  amountMax: 1_000_000_000_000,
  participantsMax: 1_000_000,
} as const;

export type PrizePool = {
  kind: PoolKind;
  /** Points, or for money the amount in minor units (for example 500000 is GH₵ 5,000.00). */
  amount: number;
  /** ISO 4217 code for money; null for points. */
  currency: PoolCurrency | null;
  /** How many people may take part; the campaign closes when this many have joined. */
  maxParticipants: number;
};

export type PoolShare = {
  /** What each participant receives, in the same unit as `amount`. */
  share: number;
  /** What is left over after equal shares (less than one share per seat); it is not paid out. */
  remainder: number;
};

/** Each seat's equal share, and the remainder that cannot be split evenly. */
export function poolShare(pool: Pick<PrizePool, 'amount' | 'maxParticipants'>): PoolShare {
  const share = Math.floor(pool.amount / pool.maxParticipants);
  return { share, remainder: pool.amount - share * pool.maxParticipants };
}

/** Why this pool cannot be used, or null. Shown to the person editing, and checked again to launch. */
export function poolProblem(pool: PrizePool): string | null {
  if (!Number.isInteger(pool.amount) || pool.amount < 1)
    return 'The prize pool must be more than zero';
  if (pool.amount > POOL_LIMITS.amountMax) return 'The prize pool is too large';
  if (
    !Number.isInteger(pool.maxParticipants) ||
    pool.maxParticipants < 1 ||
    pool.maxParticipants > POOL_LIMITS.participantsMax
  ) {
    return 'Choose how many people can take part';
  }
  if (
    pool.kind === 'MONEY' &&
    (pool.currency === null || !POOL_CURRENCIES.includes(pool.currency))
  ) {
    return 'Choose a currency for a money prize pool';
  }
  if (pool.kind === 'POINTS' && pool.currency !== null) return 'A points pool has no currency';
  if (poolShare(pool).share < 1) return 'The pool is too small to give every participant a share';
  return null;
}

/** How a pool amount reads to people: "GH₵ 5,000.00" or "10,000 points". */
export function formatPoolAmount(kind: PoolKind, amount: number, currency: string | null): string {
  if (kind === 'POINTS' || !currency) {
    return `${new Intl.NumberFormat('en').format(amount)} points`;
  }
  const factor = minorFactor(currency);
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: factor === 1 ? 0 : 2,
    maximumFractionDigits: factor === 1 ? 0 : 2,
  }).format(amount / factor);
}

/** The pool as the API shows it: what was set, plus the equal share each participant gets. */
export type PoolView = PrizePool & PoolShare & { label: string; shareLabel: string };

export function toPoolView(pool: PrizePool): PoolView {
  const s = poolShare(pool);
  return {
    ...pool,
    ...s,
    label: formatPoolAmount(pool.kind, pool.amount, pool.currency),
    shareLabel: formatPoolAmount(pool.kind, s.share, pool.currency),
  };
}

/** Reads a pool from stored JSON defensively; anything malformed is no pool. */
export function poolOf(value: unknown): PrizePool | null {
  const p = (value as { pool?: Record<string, unknown> | null } | null)?.pool;
  if (!p || typeof p !== 'object') return null;
  const kind = p.kind === 'POINTS' || p.kind === 'MONEY' ? p.kind : null;
  if (!kind || typeof p.amount !== 'number' || typeof p.maxParticipants !== 'number') return null;
  const currency =
    kind === 'MONEY' && typeof p.currency === 'string' ? (p.currency as PoolCurrency) : null;
  return { kind, amount: p.amount, currency, maxParticipants: p.maxParticipants };
}

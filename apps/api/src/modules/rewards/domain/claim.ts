import type { PrizeKind } from './model';

/**
 * Claiming an award: what a participant must give, and what an award's state means to them. Pure rules.
 */

export const PAYOUT_METHODS = ['MOBILE_MONEY', 'BANK_TRANSFER', 'DELIVERY'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export type AwardState =
  | 'PENDING_REVIEW'
  | 'AVAILABLE'
  | 'CLAIMED'
  | 'FULFILLED'
  | 'HELD'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

/** Where an award may go next. Anything not listed is not allowed (the database also guards each step). */
const NEXT: Record<AwardState, readonly AwardState[]> = {
  PENDING_REVIEW: ['AVAILABLE', 'REJECTED'],
  AVAILABLE: ['CLAIMED', 'EXPIRED', 'HELD', 'REVOKED'],
  CLAIMED: ['FULFILLED', 'HELD', 'REVOKED'],
  HELD: ['AVAILABLE', 'CLAIMED', 'REJECTED', 'REVOKED'],
  FULFILLED: [],
  REJECTED: [],
  EXPIRED: [],
  REVOKED: [],
};

export const canTransition = (from: AwardState, to: AwardState): boolean => NEXT[from].includes(to);

/** An unclaimed award past its deadline reads as expired, even before anything has written that down. */
export function effectiveState(state: AwardState, claimBy: Date | null, now: Date): AwardState {
  return state === 'AVAILABLE' && claimBy !== null && claimBy <= now ? 'EXPIRED' : state;
}

/** Points are credited at once; money and items need a place to send them, so they need more from the person. */
export const needsDestination = (kind: PrizeKind): boolean => kind !== 'POINTS';

/** Points with a known amount are credited straight to the ledger when claimed. */
export const creditsAtClaim = (kind: PrizeKind, amountMinor: number | null): boolean =>
  kind === 'POINTS' && amountMinor !== null && amountMinor > 0;

export type DestinationInput = { method?: string; destination?: string; accountName?: string };
export type ValidDestination = {
  method: PayoutMethod;
  accountName: string;
  /** Normalised, so the same number typed two ways is the same destination. */
  destination: string;
  /** Masked tail to show back: "••••1234". */
  hint: string;
};

const digitsOnly = (s: string): string => s.replace(/[\s\-().]/g, '');

/** Checks where the award should go. `problem` is shown to the person. */
export function validateDestination(
  input: DestinationInput,
): { ok: true; value: ValidDestination } | { ok: false; problem: string } {
  const method = PAYOUT_METHODS.find((m) => m === input.method);
  if (!method) return { ok: false, problem: 'Choose how you want to receive this reward' };
  const accountName = (input.accountName ?? '').trim().replace(/\s+/g, ' ');
  if (accountName.length < 2 || accountName.length > 100) {
    return { ok: false, problem: 'Enter the name on the account or the name for delivery' };
  }
  const raw = (input.destination ?? '').trim();
  if (method === 'DELIVERY') {
    if (raw.length < 8 || raw.length > 300) {
      return { ok: false, problem: 'Enter a delivery address of at least 8 characters' };
    }
    const normalised = raw.replace(/\s+/g, ' ');
    return {
      ok: true,
      value: { method, accountName, destination: normalised, hint: `••••${normalised.slice(-4)}` },
    };
  }
  const number = digitsOnly(raw);
  const min = method === 'MOBILE_MONEY' ? 9 : 6;
  if (!/^\+?\d+$/.test(number) || number.replace('+', '').length < min || number.length > 24) {
    return {
      ok: false,
      problem:
        method === 'MOBILE_MONEY'
          ? 'Enter a valid mobile money number'
          : 'Enter a valid account number',
    };
  }
  return {
    ok: true,
    value: { method, accountName, destination: number, hint: `••••${number.slice(-4)}` },
  };
}

import type { MyAward, PayoutMethod } from './types';

/** Minor units per major unit, for the few currencies that have none (kept in step with the API's pool rules). */
const NO_MINOR = new Set(['UGX', 'RWF', 'XOF']);

/** The award's value as people read it: "GH₵ 50.00", "40 points", or null while it is only text. */
export function awardAmount(a: Pick<MyAward, 'kind' | 'amountMinor' | 'currency'>): string | null {
  if (a.amountMinor === null) return null;
  if (a.kind === 'POINTS') return `${new Intl.NumberFormat('en').format(a.amountMinor)} points`;
  if (a.kind === 'CASH' && a.currency) {
    const flat = NO_MINOR.has(a.currency);
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: a.currency,
      minimumFractionDigits: flat ? 0 : 2,
      maximumFractionDigits: flat ? 0 : 2,
    }).format(a.amountMinor / (flat ? 1 : 100));
  }
  return null;
}

/** An award can be claimed only while it is available; everything else is shown for information. */
export const canClaim = (a: Pick<MyAward, 'status'>): boolean => a.status === 'AVAILABLE';

/** Which of the page's lists an award belongs in. */
export function section(a: Pick<MyAward, 'status'>): 'available' | 'history' {
  return canClaim(a) ? 'available' : 'history';
}

/** The shared status vocabulary has no word for review or rejection, so those read as held and forfeited. */
export function chipStatus(status: string): string {
  if (status === 'PENDING_REVIEW') return 'HELD';
  if (status === 'REJECTED') return 'FORFEITED';
  return status;
}

export const PAYOUT_METHODS: PayoutMethod[] = ['MOBILE_MONEY', 'BANK_TRANSFER', 'DELIVERY'];

/** What a person who has just won should be offered: claim now, wait out a check, or look at where it stands. */
export function rewardPrompt(a: Pick<MyAward, 'status'>): 'claim' | 'checking' | 'view' {
  if (a.status === 'AVAILABLE') return 'claim';
  return a.status === 'PENDING_REVIEW' || a.status === 'HELD' ? 'checking' : 'view';
}

/** Whole days left to claim, or null when there is no deadline or it has passed. */
export function daysLeft(claimBy: string | null, now: Date): number | null {
  if (!claimBy) return null;
  const ms = new Date(claimBy).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null;
}

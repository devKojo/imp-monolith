import type { BusinessAward } from './types';

/** Who may settle and pay out rewards. Mirrors the API (which still decides); it only shows or hides the page. */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);
export const canManageRewards = (role: string | undefined): boolean =>
  role !== undefined && MANAGE.has(role);

/** A claimed cash or item award is waiting for the business to send it. Points are credited at claim. */
export const needsPayment = (a: Pick<BusinessAward, 'status' | 'kind'>): boolean =>
  a.status === 'CLAIMED' && a.kind !== 'POINTS';

export type AwardCounts = {
  total: number;
  toPay: number;
  paid: number;
  unclaimed: number;
  held: number;
};

/** The figures above the list: how many are owed, paid, still unclaimed or held for review. */
export function countAwards(awards: readonly BusinessAward[]): AwardCounts {
  const counts: AwardCounts = { total: awards.length, toPay: 0, paid: 0, unclaimed: 0, held: 0 };
  for (const a of awards) {
    if (needsPayment(a)) counts.toPay++;
    else if (a.status === 'FULFILLED') counts.paid++;
    else if (a.status === 'AVAILABLE') counts.unclaimed++;
    else if (a.status === 'PENDING_REVIEW' || a.status === 'HELD') counts.held++;
  }
  return counts;
}

/** What is wrong with a payment reference, or null. Matches the API: 3 to 80 characters once trimmed. */
export function referenceProblem(reference: string): 'short' | 'long' | null {
  const n = reference.trim().length;
  return n < 3 ? 'short' : n > 80 ? 'long' : null;
}

/** A campaign can be settled once it has ended and has no awards yet. */
export const canSettle = (
  c: { status: string; endAt: string | null },
  awardCount: number,
  now: Date,
): boolean =>
  awardCount === 0 &&
  c.status !== 'DRAFT' &&
  c.status !== 'CANCELLED' &&
  (c.status === 'COMPLETED' || (c.endAt !== null && new Date(c.endAt) <= now));

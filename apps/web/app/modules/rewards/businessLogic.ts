import type { BusinessAward } from './types';

/** Who may settle and pay out rewards. Mirrors the API (which still decides); it only shows or hides the page. */
const MANAGE = new Set(['BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER']);
export const canManageRewards = (role: string | undefined): boolean =>
  role !== undefined && MANAGE.has(role);

/** A claimed cash or item award is waiting for the business to send it. Points are credited at claim. */
export const needsPayment = (a: Pick<BusinessAward, 'status' | 'kind'>): boolean =>
  a.status === 'CLAIMED' && a.kind !== 'POINTS';

/** Mirrors the API's bands (which still decide): review from 30, platform only from 70. */
export const REVIEW_AT = 30;
export const FLAG_AT = 70;

/** A business can recall an award it has not paid yet: still available to claim, or claimed and waiting to be paid. */
export const canRecall = (a: Pick<BusinessAward, 'status'>): boolean =>
  a.status === 'AVAILABLE' || a.status === 'CLAIMED';

/** An award the risk rules held, before or after it was claimed. */
export const waitsForReview = (a: Pick<BusinessAward, 'status'>): boolean =>
  a.status === 'PENDING_REVIEW' || a.status === 'HELD';

/** Flagged high risk: a business may reject it but only the platform may release it. */
export const needsPlatform = (a: Pick<BusinessAward, 'status' | 'riskScore'>): boolean =>
  waitsForReview(a) && a.riskScore >= FLAG_AT;

/**
 * The campaigns that match what was typed in the picker's search (title, case and accent insensitive; every
 * word must appear). The chosen campaign always stays in the list so a search never drops the selection.
 */
export function matchCampaigns<T extends { id: string; title: string }>(
  items: readonly T[],
  query: string,
  selectedId = '',
): T[] {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((c) => c.id === selectedId || words.every((w) => fold(c.title).includes(w)));
}

export type RiskBand = 'none' | 'REVIEW' | 'FLAG';
export const riskBand = (score: number): RiskBand =>
  score >= FLAG_AT ? 'FLAG' : score >= REVIEW_AT ? 'REVIEW' : 'none';

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

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  matchCampaigns,
  canManageRewards,
  canRecall,
  needsPlatform,
  riskBand,
  waitsForReview,
  canSettle,
  countAwards,
  needsPayment,
  referenceProblem,
} from './businessLogic';
import type { BusinessAward } from './types';

const award = (over: Partial<BusinessAward>): BusinessAward => ({
  id: 'a',
  userId: 'u',
  name: 'Ama',
  prizeId: null,
  slot: 1,
  rank: 1,
  kind: 'CASH',
  amountMinor: 5000,
  currency: 'GHS',
  source: 'RANKING',
  status: 'CLAIMED',
  claimBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  payoutMethod: null,
  payoutHint: null,
  paidReference: null,
  riskScore: 0,
  riskReasons: [],
  ...over,
});

describe('canManageRewards', () => {
  it('is for the people who run the business', () => {
    expect(canManageRewards('BUSINESS_OWNER')).toBe(true);
    expect(canManageRewards('CAMPAIGN_MANAGER')).toBe(true);
    expect(canManageRewards('ANALYST')).toBe(false);
    expect(canManageRewards(undefined)).toBe(false);
  });
});

describe('needsPayment', () => {
  it('is a claimed cash or item award, never points', () => {
    expect(needsPayment(award({}))).toBe(true);
    expect(needsPayment(award({ kind: 'ITEM' }))).toBe(true);
    expect(needsPayment(award({ kind: 'POINTS' }))).toBe(false);
    expect(needsPayment(award({ status: 'AVAILABLE' }))).toBe(false);
    expect(needsPayment(award({ status: 'FULFILLED' }))).toBe(false);
  });
});

describe('countAwards', () => {
  it('counts what is owed, paid, unclaimed and held', () => {
    const counts = countAwards([
      award({}),
      award({ status: 'FULFILLED' }),
      award({ status: 'AVAILABLE' }),
      award({ status: 'PENDING_REVIEW' }),
      award({ kind: 'POINTS', status: 'FULFILLED' }),
    ]);
    expect(counts).toEqual({ total: 5, toPay: 1, paid: 2, unclaimed: 1, held: 1 });
  });
});

describe('referenceProblem', () => {
  it('needs 3 to 80 characters once trimmed', () => {
    expect(referenceProblem('  ab ')).toBe('short');
    expect(referenceProblem('MOMO-1')).toBeNull();
    expect(referenceProblem('x'.repeat(81))).toBe('long');
  });
});

describe('canSettle', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('needs an ended campaign with no awards yet', () => {
    expect(canSettle({ status: 'RUNNING', endAt: '2026-05-01T00:00:00Z' }, 0, now)).toBe(true);
    expect(canSettle({ status: 'RUNNING', endAt: '2026-07-01T00:00:00Z' }, 0, now)).toBe(false);
    expect(canSettle({ status: 'COMPLETED', endAt: '2026-07-01T00:00:00Z' }, 0, now)).toBe(true);
    expect(canSettle({ status: 'RUNNING', endAt: '2026-05-01T00:00:00Z' }, 3, now)).toBe(false);
    expect(canSettle({ status: 'DRAFT', endAt: '2026-05-01T00:00:00Z' }, 0, now)).toBe(false);
    expect(canSettle({ status: 'CANCELLED', endAt: null }, 0, now)).toBe(false);
  });
});

describe('risk review', () => {
  it('waits for review while pending or held', () => {
    expect(waitsForReview(award({ status: 'PENDING_REVIEW' }))).toBe(true);
    expect(waitsForReview(award({ status: 'HELD' }))).toBe(true);
    expect(waitsForReview(award({ status: 'AVAILABLE' }))).toBe(false);
  });
  it('leaves high-risk awards to the platform', () => {
    expect(needsPlatform(award({ status: 'HELD', riskScore: 70 }))).toBe(true);
    expect(needsPlatform(award({ status: 'HELD', riskScore: 69 }))).toBe(false);
    expect(needsPlatform(award({ status: 'AVAILABLE', riskScore: 90 }))).toBe(false);
  });
  it('bands a score', () => {
    expect([0, 29, 30, 69, 70].map(riskBand)).toEqual(['none', 'none', 'REVIEW', 'REVIEW', 'FLAG']);
  });
});

describe('canRecall', () => {
  it('covers an award not yet paid: available to claim, or claimed', () => {
    expect(canRecall(award({ status: 'AVAILABLE' }))).toBe(true);
    expect(canRecall(award({ status: 'CLAIMED' }))).toBe(true);
    expect(canRecall(award({ status: 'FULFILLED' }))).toBe(false);
    expect(canRecall(award({ status: 'REVOKED' }))).toBe(false);
  });
});

describe('matchCampaigns', () => {
  const items = [
    { id: 'a', title: 'Summer Quiz' },
    { id: 'b', title: 'Café Giveaway' },
    { id: 'c', title: 'Winter Survey' },
  ];
  it('returns everything for an empty search', () => {
    expect(matchCampaigns(items, '  ')).toHaveLength(3);
  });
  it('matches every word, ignoring case and accents', () => {
    expect(matchCampaigns(items, 'cafe give').map((c) => c.id)).toEqual(['b']);
    expect(matchCampaigns(items, 'QUIZ').map((c) => c.id)).toEqual(['a']);
    expect(matchCampaigns(items, 'summer survey')).toEqual([]);
  });
  it('keeps the selected campaign in the list', () => {
    expect(matchCampaigns(items, 'quiz', 'c').map((c) => c.id)).toEqual(['a', 'c']);
  });
});

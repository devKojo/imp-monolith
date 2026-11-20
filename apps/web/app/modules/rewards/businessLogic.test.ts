// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  canManageRewards,
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

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatPoolAmount,
  poolOf,
  poolProblem,
  poolShare,
  toPoolView,
  type PrizePool,
} from '../domain/pool';
import { preflight } from '../domain/rules';
import { detailsDraft, giveawayTemplate } from './fixtures';

const points: PrizePool = { kind: 'POINTS', amount: 10_000, currency: null, maxParticipants: 100 };
const money: PrizePool = {
  kind: 'MONEY',
  amount: 500_000,
  currency: 'GHS',
  maxParticipants: 200,
};

describe('poolShare', () => {
  it('splits the pool evenly across the seats', () => {
    expect(poolShare(points)).toEqual({ share: 100, remainder: 0 });
    expect(poolShare(money)).toEqual({ share: 2500, remainder: 0 });
  });

  it('rounds each share down and reports what cannot be split', () => {
    expect(poolShare({ amount: 1000, maxParticipants: 3 })).toEqual({ share: 333, remainder: 1 });
    const { share, remainder } = poolShare({ amount: 999_999, maxParticipants: 7 });
    expect(share * 7 + remainder).toBe(999_999);
    expect(remainder).toBeLessThan(7);
  });
});

describe('poolProblem', () => {
  it('accepts a points pool and a money pool', () => {
    expect(poolProblem(points)).toBeNull();
    expect(poolProblem(money)).toBeNull();
  });

  it('refuses what cannot work', () => {
    expect(poolProblem({ ...points, amount: 0 })).toMatch(/more than zero/);
    expect(poolProblem({ ...points, maxParticipants: 0 })).toMatch(/how many/);
    expect(poolProblem({ ...points, maxParticipants: 2.5 })).toMatch(/how many/);
    expect(poolProblem({ ...money, currency: null })).toMatch(/currency/);
    expect(poolProblem({ ...points, currency: 'GHS' })).toMatch(/no currency/);
    // Fewer points than seats: nobody could get a whole point.
    expect(poolProblem({ ...points, amount: 50 })).toMatch(/too small/);
  });
});

describe('formatting and reading', () => {
  it('writes points and money the way people read them', () => {
    expect(formatPoolAmount('POINTS', 10_000, null)).toBe('10,000 points');
    expect(formatPoolAmount('MONEY', 500_000, 'USD')).toBe('$5,000.00');
    // A currency without minor units is shown whole.
    expect(formatPoolAmount('MONEY', 5000, 'UGX')).toMatch(/5,000$/);
  });

  it('builds the view with each share worked out', () => {
    expect(toPoolView(money)).toMatchObject({
      share: 2500,
      shareLabel: expect.stringContaining('25.00'),
    });
  });

  it('reads a stored pool defensively', () => {
    expect(poolOf({ pool: money })).toEqual(money);
    expect(
      poolOf({ pool: { kind: 'POINTS', amount: 5, maxParticipants: 1, currency: 'USD' } }),
    ).toEqual({
      kind: 'POINTS',
      amount: 5,
      currency: null,
      maxParticipants: 1,
    });
    expect(poolOf({})).toBeNull();
    expect(poolOf(null)).toBeNull();
    expect(poolOf({ pool: { kind: 'CASH', amount: 1, maxParticipants: 1 } })).toBeNull();
  });
});

describe('launch checks with a pool', () => {
  const input = (pool: PrizePool | null) => ({
    title: 'Pool',
    template: giveawayTemplate,
    startAt: null,
    endAt: new Date('2026-12-01T00:00:00Z'),
    prizes: [],
    fields: detailsDraft().map((f) => ({ ...f, key: f.kind })),
    pool,
  });
  const now = new Date('2026-11-14T00:00:00Z');
  const passes = (pool: PrizePool | null) =>
    preflight(input(pool), now).find((c) => c.id === 'prizes')?.pass;

  it('is satisfied by a complete pool in place of prize tiers', () => {
    expect(passes(points)).toBe(true);
  });

  it('fails when the pool is incomplete, and when a prize type has neither tiers nor a pool', () => {
    expect(passes({ ...points, amount: 0 })).toBe(false);
    expect(passes(null)).toBe(false);
  });
});

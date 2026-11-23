import { describe, expect, it } from 'vitest';
import type { Entrant, PrizeRow } from '../domain/model';
import {
  drawPlan,
  expandSlots,
  poolPlan,
  rankEntrants,
  rankingPlan,
  selectionOf,
} from '../domain/plan';

const prize = (over: Partial<PrizeRow> & { id: string; position: number }): PrizeRow => ({
  name: over.id,
  kind: 'CASH',
  amountMinor: 1000,
  currency: 'GHS',
  winners: 1,
  rankFrom: null,
  rankTo: null,
  selection: null,
  ...over,
});
const at = (n: number) => new Date(2026, 0, 1, 0, 0, n);
const person = (userId: string, score: number | null, secs = 0): Entrant => ({
  userId,
  score,
  at: at(secs),
});

describe('expandSlots', () => {
  it('gives 1st, 2nd and 3rd to 4th from winner counts alone', () => {
    const slots = expandSlots([
      prize({ id: 'first', position: 1 }),
      prize({ id: 'second', position: 2 }),
      prize({ id: 'rest', position: 3, winners: 2 }),
    ]);
    expect(slots.map((s) => [s.prize.id, s.rank, s.slot])).toEqual([
      ['first', 1, 1],
      ['second', 2, 1],
      ['rest', 3, 1],
      ['rest', 4, 2],
    ]);
  });
  it('honours an explicit placing range', () => {
    const slots = expandSlots([
      prize({ id: 'top', position: 1, rankFrom: 1, rankTo: 1 }),
      prize({ id: 'next', position: 2, rankFrom: 2, rankTo: 5 }),
    ]);
    expect(slots.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(slots.filter((s) => s.prize.id === 'next')).toHaveLength(4);
  });
});

describe('rankEntrants', () => {
  it('orders by score, then who finished first, then user id (never random)', () => {
    const ranked = rankEntrants([
      person('c', 8, 5),
      person('b', 9, 9),
      person('a', 9, 9),
      person('d', 9, 1),
    ]);
    expect(ranked.map((e) => e.userId)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('rankingPlan', () => {
  const prizes = [prize({ id: 'first', position: 1 }), prize({ id: 'second', position: 2 })];
  it('awards the best people the places in order', () => {
    const plan = rankingPlan(prizes, [person('x', 5), person('y', 9), person('z', 7)]);
    expect(plan.map((a) => [a.userId, a.prizeId, a.rank])).toEqual([
      ['y', 'first', 1],
      ['z', 'second', 2],
    ]);
    expect(plan[0]).toMatchObject({
      kind: 'CASH',
      amountMinor: 1000,
      currency: 'GHS',
      source: 'RANKING',
    });
  });
  it('leaves a place empty when there are too few entrants', () => {
    expect(rankingPlan(prizes, [person('only', 3)])).toHaveLength(1);
    expect(rankingPlan(prizes, [])).toEqual([]);
  });
});

describe('drawPlan', () => {
  it('gives the drawn people the places in order, without ranks', () => {
    const plan = drawPlan([prize({ id: 'p', position: 1, winners: 2 })], ['u3', 'u1', 'u2']);
    expect(plan.map((a) => [a.userId, a.slot, a.rank])).toEqual([
      ['u3', 1, null],
      ['u1', 2, null],
    ]);
  });
});

describe('poolPlan', () => {
  it('gives every participant the same whole share, once', () => {
    const plan = poolPlan({ kind: 'MONEY', amount: 1000, currency: 'GHS', maxParticipants: 3 }, [
      'b',
      'a',
      'a',
      'c',
    ]);
    expect(plan.map((a) => a.userId)).toEqual(['a', 'b', 'c']);
    expect(
      plan.every((a) => a.amountMinor === 333 && a.kind === 'CASH' && a.prizeId === null),
    ).toBe(true);
  });
  it('is a points award for a points pool', () => {
    const [a] = poolPlan({ kind: 'POINTS', amount: 100, currency: null, maxParticipants: 4 }, [
      'u',
    ]);
    expect(a).toMatchObject({ kind: 'POINTS', amountMinor: 25, currency: null, source: 'POOL' });
  });
});

describe('selectionOf', () => {
  const base = { prizes: [prize({ id: 'p', position: 1 })], pool: null };
  it('defaults by campaign type', () => {
    expect(selectionOf({ ...base, archetype: 'QUIZ' })).toEqual({ ok: true, selection: 'RANKING' });
    expect(selectionOf({ ...base, archetype: 'GIVEAWAY' })).toEqual({
      ok: true,
      selection: 'DRAW',
    });
  });
  it('shares a pool equally', () => {
    const pool = { kind: 'POINTS' as const, amount: 10, currency: null, maxParticipants: 2 };
    expect(selectionOf({ archetype: 'SURVEY', prizes: [], pool })).toEqual({
      ok: true,
      selection: 'POOL',
    });
  });
  it('has nothing to settle when tiers go to the first to qualify', () => {
    expect(
      selectionOf({
        archetype: 'QUIZ',
        pool: null,
        prizes: [prize({ id: 'p', position: 1, selection: 'COMPLETION' })],
      }),
    ).toEqual({ ok: false, reason: 'AS_QUALIFIED' });
  });
  it('refuses what cannot be settled in one step', () => {
    expect(selectionOf({ archetype: 'QUIZ', prizes: [], pool: null })).toEqual({
      ok: false,
      reason: 'NO_PRIZES',
    });
    expect(
      selectionOf({
        archetype: 'QUIZ',
        pool: null,
        prizes: [
          prize({ id: 'a', position: 1, selection: 'DRAW' }),
          prize({ id: 'b', position: 2, selection: 'RANKING' }),
        ],
      }),
    ).toEqual({ ok: false, reason: 'MIXED' });
  });
});

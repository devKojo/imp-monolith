// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  amountText,
  formatAmount,
  newPool,
  parseAmount,
  poolProblem,
  poolShare,
  withKind,
} from './pool';

const money = { kind: 'MONEY', currency: 'GHS' } as const;
const points = { kind: 'POINTS', currency: null } as const;

describe('parseAmount', () => {
  it('turns what is typed into the stored whole number', () => {
    expect(parseAmount('5000', money)).toBe(500_000);
    expect(parseAmount('5,000.50', money)).toBe(500_050);
    expect(parseAmount('0.5', money)).toBe(50);
    expect(parseAmount('10000', points)).toBe(10_000);
    expect(parseAmount('5000', { kind: 'MONEY', currency: 'UGX' })).toBe(5000);
  });

  it('refuses what is not an amount', () => {
    for (const bad of ['', 'abc', '1.234', '-5', '1e3']) expect(parseAmount(bad, money)).toBeNull();
    expect(parseAmount('10.5', points)).toBeNull();
    expect(parseAmount('99999999999999999', points)).toBeNull();
  });
});

describe('amountText', () => {
  it('shows the stored amount the way it is typed', () => {
    expect(amountText({ ...money, amount: 500_000 })).toBe('5000');
    expect(amountText({ ...money, amount: 500_050 })).toBe('5000.50');
    expect(amountText({ ...points, amount: 10_000 })).toBe('10000');
    expect(amountText({ ...points, amount: 0 })).toBe('');
  });
});

describe('poolShare and poolProblem', () => {
  it('works out equal shares and the remainder', () => {
    expect(poolShare({ amount: 1000, maxParticipants: 3 })).toEqual({ share: 333, remainder: 1 });
    expect(poolShare({ amount: 1000, maxParticipants: 0 })).toEqual({ share: 0, remainder: 1000 });
  });

  it('names what is missing', () => {
    expect(poolProblem(newPool())).toBe('amount');
    expect(poolProblem({ ...newPool(), amount: 100 })).toBe('participants');
    expect(
      poolProblem({ ...newPool('MONEY'), amount: 100, maxParticipants: 5, currency: null }),
    ).toBe('currency');
    expect(poolProblem({ ...newPool(), amount: 5, maxParticipants: 10 })).toBe('small');
    expect(poolProblem({ ...newPool(), amount: 1000, maxParticipants: 10 })).toBeNull();
  });
});

describe('formatting and switching', () => {
  it('writes points and money', () => {
    expect(formatAmount(points, 10_000)).toBe('10,000 points');
    expect(formatAmount({ kind: 'MONEY', currency: 'USD' }, 500_000)).toBe('$5,000.00');
  });

  it('keeps a currency for money and drops it for points', () => {
    expect(withKind(newPool(), 'MONEY').currency).toBe('GHS');
    expect(withKind({ ...newPool('MONEY'), currency: 'KES' }, 'POINTS').currency).toBeNull();
    expect(withKind({ ...newPool('MONEY'), currency: 'KES' }, 'MONEY').currency).toBe('KES');
  });
});

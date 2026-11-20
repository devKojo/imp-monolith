// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  amountInput,
  amountPatch,
  currencyPatch,
  placeOf,
  rewardProblem,
  withKind,
} from './prizeRewards';
import type { Prize } from './types';

const prize = (over: Partial<Prize> = {}): Prize => ({
  id: 'p',
  name: 'Cash',
  valueLabel: '',
  winners: 1,
  description: '',
  kind: 'ITEM',
  amountMinor: null,
  currency: null,
  rankFrom: null,
  rankTo: null,
  ...over,
});

describe('withKind', () => {
  it('starts the amount again, with a currency only for cash', () => {
    expect(withKind('CASH')).toEqual({ kind: 'CASH', amountMinor: null, currency: 'GHS' });
    expect(withKind('POINTS')).toEqual({ kind: 'POINTS', amountMinor: null, currency: null });
    expect(withKind('ITEM').currency).toBeNull();
  });
});

describe('amounts', () => {
  it('reads cash in major units and points as a count', () => {
    expect(amountPatch({ kind: 'CASH', currency: 'GHS' }, '50.25')).toEqual({ amountMinor: 5025 });
    expect(amountPatch({ kind: 'CASH', currency: 'UGX' }, '5000')).toEqual({ amountMinor: 5000 });
    expect(amountPatch({ kind: 'POINTS', currency: null }, '120')).toEqual({ amountMinor: 120 });
    expect(amountPatch({ kind: 'POINTS', currency: null }, '1.5')).toEqual({ amountMinor: null });
    expect(amountPatch({ kind: 'ITEM', currency: null }, '5')).toEqual({ amountMinor: null });
  });
  it('reads the typed amount again when the currency changes', () => {
    expect(currencyPatch('UGX', '5000')).toEqual({ currency: 'UGX', amountMinor: 5000 });
    expect(currencyPatch('GHS', '5000')).toEqual({ currency: 'GHS', amountMinor: 500000 });
  });
  it('shows the stored amount as it is typed', () => {
    expect(amountInput(prize({ kind: 'CASH', currency: 'GHS', amountMinor: 5025 }))).toBe('50.25');
    expect(amountInput(prize({ kind: 'POINTS', amountMinor: 120 }))).toBe('120');
    expect(amountInput(prize())).toBe('');
  });
});

describe('placeOf', () => {
  it('is a whole number from 1, or null', () => {
    expect(placeOf('3')).toBe(3);
    expect(placeOf('')).toBeNull();
    expect(placeOf('0')).toBeNull();
    expect(placeOf('1.5')).toBeNull();
  });
});

describe('rewardProblem', () => {
  it('asks for an amount, whole places and a matching count', () => {
    expect(rewardProblem(prize())).toBeNull();
    expect(rewardProblem(prize({ kind: 'CASH', currency: 'GHS' }))).toBe('amount');
    expect(rewardProblem(prize({ rankFrom: 1 }))).toBe('place');
    expect(rewardProblem(prize({ rankFrom: 3, rankTo: 2 }))).toBe('place');
    expect(rewardProblem(prize({ rankFrom: 1, rankTo: 3 }))).toBe('count');
    expect(rewardProblem(prize({ winners: 3, rankFrom: 2, rankTo: 4 }))).toBeNull();
  });
});

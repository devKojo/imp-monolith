// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isOption, labelOf, leader, resultFor, rankOf } from './logic';
import type { BallotOption, Results } from './types';

const options: BallotOption[] = [
  { index: 0, label: 'Aether', description: '', imageUrl: '' },
  { index: 1, label: 'Nebula', description: '', imageUrl: '' },
];
const results: Results = {
  total: 3,
  options: [
    { index: 0, votes: 1, percent: 33 },
    { index: 1, votes: 2, percent: 67 },
  ],
};

describe('resultFor', () => {
  it('reads one option from the standings', () => {
    expect(resultFor(results, 1)).toEqual({ index: 1, votes: 2, percent: 67 });
  });
  it('is zeros when there are no standings or no such option', () => {
    expect(resultFor(null, 0)).toEqual({ index: 0, votes: 0, percent: 0 });
    expect(resultFor(results, 5)).toEqual({ index: 5, votes: 0, percent: 0 });
  });
});

describe('leader', () => {
  it('is the option with the most votes', () => {
    expect(leader(results)).toBe(1);
  });
  it('is nobody before the first vote, and the earlier option on a tie', () => {
    expect(leader(null)).toBeNull();
    expect(
      leader({ total: 0, options: results.options.map((o) => ({ ...o, votes: 0 })) }),
    ).toBeNull();
    expect(
      leader({
        total: 2,
        options: [
          { index: 0, votes: 1, percent: 50 },
          { index: 1, votes: 1, percent: 50 },
        ],
      }),
    ).toBe(0);
  });
});

describe('labelOf and isOption', () => {
  it('names an option by its number', () => {
    expect(labelOf(options, 1)).toBe('Nebula');
    expect(labelOf(options, null)).toBe('');
    expect(labelOf(options, 9)).toBe('');
  });
  it('accepts only an option that exists', () => {
    expect(isOption(options, 0)).toBe(true);
    expect(isOption(options, 2)).toBe(false);
    expect(isOption(options, null)).toBe(false);
  });
});

describe('rankOf', () => {
  const results = {
    total: 10,
    options: [
      { index: 0, votes: 4, percent: 40 },
      { index: 1, votes: 4, percent: 40 },
      { index: 2, votes: 2, percent: 20 },
    ],
  };
  it('puts the most votes first and shares a place on a tie', () => {
    expect(rankOf(results, 0)).toBe(1);
    expect(rankOf(results, 1)).toBe(1);
    expect(rankOf(results, 2)).toBe(3);
  });
  it('is null without standings', () => {
    expect(rankOf(null, 0)).toBeNull();
  });
});

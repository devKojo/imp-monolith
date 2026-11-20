import type { BallotOption, OptionResult, Results } from './types';

/** Pure helpers for the voting screens: every function returns new data and never mutates. */

/** The standing of one option, or zeros when there is none (for example before the first vote). */
export const resultFor = (results: Results | null, index: number): OptionResult =>
  results?.options.find((o) => o.index === index) ?? { index, votes: 0, percent: 0 };

/** The option with the most votes, or null while nobody has voted. Ties go to the earlier option. */
export function leader(results: Results | null): number | null {
  if (!results || results.total === 0) return null;
  let best = results.options[0]!;
  for (const o of results.options) if (o.votes > best.votes) best = o;
  return best.index;
}

/** The label of an option by its number, or an empty string if there is none. */
export const labelOf = (options: readonly BallotOption[], index: number | null): string =>
  index === null ? '' : (options.find((o) => o.index === index)?.label ?? '');

/** Whether the option exists, so the vote button can stay off until a real one is chosen. */
export const isOption = (options: readonly BallotOption[], index: number | null): index is number =>
  index !== null && options.some((o) => o.index === index);

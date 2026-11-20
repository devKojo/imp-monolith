import type {
  Ballot,
  BallotField,
  BallotKind,
  OptionResult,
  Results,
  StoredVote,
  TallyRow,
} from './model';

/** Pure rules for voting: no I/O and no clock of their own. */

/**
 * The options of a ballot, from the campaign's fields in order. A poll has one question whose answers are
 * the options; an image vote has one candidate field per option.
 */
export function buildBallot(kind: BallotKind, fields: readonly BallotField[]): Ballot {
  if (kind === 'poll') {
    const question = fields.find((f) => f.kind === 'choice');
    return {
      kind,
      question: question?.label ?? '',
      helper: question?.helper ?? '',
      options: (question?.options ?? []).map((label, index) => ({
        index,
        label,
        description: '',
        imageUrl: '',
      })),
    };
  }
  return {
    kind,
    question: '',
    helper: '',
    options: fields
      .filter((f) => f.kind === 'candidate')
      .map((f, index) => ({ index, label: f.label, description: f.helper, imageUrl: f.imageUrl })),
  };
}

/** What is stored for a vote for option `index`, or null when there is no such option. */
export function targetOf(
  kind: BallotKind,
  fields: readonly BallotField[],
  index: number,
): { fieldId: string; choiceIndex: number | null } | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (kind === 'poll') {
    const question = fields.find((f) => f.kind === 'choice');
    return question && index < question.options.length
      ? { fieldId: question.id, choiceIndex: index }
      : null;
  }
  const candidate = fields.filter((f) => f.kind === 'candidate')[index];
  return candidate ? { fieldId: candidate.id, choiceIndex: null } : null;
}

/** The option a stored vote is for, or null if the campaign no longer has it. */
export function optionIndexOf(
  kind: BallotKind,
  fields: readonly BallotField[],
  vote: Pick<StoredVote, 'fieldId' | 'choiceIndex'>,
): number | null {
  if (kind === 'poll') return vote.choiceIndex;
  const at = fields.filter((f) => f.kind === 'candidate').findIndex((f) => f.id === vote.fieldId);
  return at === -1 ? null : at;
}

/**
 * The standings: votes and whole-number percentages per option, in option order. Percentages add up to
 * exactly 100 (the largest remainders round up), or are all zero when nobody has voted.
 */
export function toResults(
  kind: BallotKind,
  fields: readonly BallotField[],
  optionCount: number,
  tally: readonly TallyRow[],
): Results {
  const votes = Array.from({ length: optionCount }, () => 0);
  for (const row of tally) {
    const at = optionIndexOf(kind, fields, row);
    if (at !== null && at < optionCount) votes[at]! += row.votes;
  }
  const total = votes.reduce((a, b) => a + b, 0);
  const exact = votes.map((v) => (total === 0 ? 0 : (v * 100) / total));
  const floor = exact.map(Math.floor);
  let left = total === 0 ? 0 : 100 - floor.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    floor[i]! += 1;
    left -= 1;
  }
  const options: OptionResult[] = votes.map((v, index) => ({
    index,
    votes: v,
    percent: floor[index]!,
  }));
  return { total, options };
}

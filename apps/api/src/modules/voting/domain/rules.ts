import type {
  Ballot,
  BallotField,
  BallotKind,
  BallotQuestion,
  OptionResult,
  Results,
  StoredVote,
  TallyRow,
  VoteTarget,
} from './model';

/** Pure rules for voting: no I/O and no clock of their own. */

const toOptions = (labels: readonly string[]) =>
  labels.map((label, index) => ({ index, label, description: '', imageUrl: '' }));

/**
 * The questions of a ballot, from the campaign's fields in order. A poll has one question per choice field,
 * whose answers are the options; an image vote has one question made of its candidate fields.
 */
export function buildQuestions(kind: BallotKind, fields: readonly BallotField[]): BallotQuestion[] {
  if (kind === 'poll') {
    return fields
      .filter((f) => f.kind === 'choice')
      .map((f) => ({
        id: f.id,
        question: f.label,
        helper: f.helper,
        options: toOptions(f.options),
      }));
  }
  return [
    {
      id: 'candidates',
      question: '',
      helper: '',
      options: fields
        .filter((f) => f.kind === 'candidate')
        .map((f, index) => ({
          index,
          label: f.label,
          description: f.helper,
          imageUrl: f.imageUrl,
        })),
    },
  ];
}

/** The ballot. Its top-level question, helper and options are the first question's. */
export function buildBallot(kind: BallotKind, fields: readonly BallotField[]): Ballot {
  const questions = buildQuestions(kind, fields);
  const first = questions[0];
  return {
    kind,
    question: first?.question ?? '',
    helper: first?.helper ?? '',
    options: first?.options ?? [],
    questions,
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

/**
 * What is stored for a ballot answered with `choices` (one per question, in order), or null when the answers do
 * not fit: the wrong number of them, or one that is not an option of its question.
 */
export function targetOfChoices(
  kind: BallotKind,
  fields: readonly BallotField[],
  choices: readonly number[],
): VoteTarget | null {
  const questions = buildQuestions(kind, fields);
  if (questions.length === 0 || choices.length !== questions.length) return null;
  if (kind === 'vote') {
    const one = targetOf(kind, fields, choices[0]!);
    return one ? { ...one, answers: {} } : null;
  }
  const answers: Record<string, number> = {};
  for (const [i, q] of questions.entries()) {
    const c = choices[i]!;
    if (!Number.isInteger(c) || c < 0 || c >= q.options.length) return null;
    answers[q.id] = c;
  }
  const first = questions[0]!;
  return { fieldId: first.id, choiceIndex: answers[first.id]!, answers };
}

/** The answer a stored vote gives to one question of a poll, or null (a question added since, for example). */
export function answerTo(vote: StoredVote, questionId: string): number | null {
  const given = vote.answers[questionId];
  if (typeof given === 'number') return given;
  // A poll cast when it had one question has no `answers`: its field and choice are the answer.
  return Object.keys(vote.answers).length === 0 && vote.fieldId === questionId
    ? vote.choiceIndex
    : null;
}

/** The standings of question number `at`: the tally rows that belong to it, counted like a single ballot. */
export function questionResults(
  kind: BallotKind,
  fields: readonly BallotField[],
  at: number,
  tally: readonly TallyRow[],
): Results {
  const question = buildQuestions(kind, fields)[at];
  if (!question) return { total: 0, options: [] };
  const rows = kind === 'poll' ? tally.filter((r) => r.fieldId === question.id) : tally;
  return toResults(kind, fields, question.options.length, rows);
}

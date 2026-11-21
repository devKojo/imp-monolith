import { describe, expect, it } from 'vitest';
import type { BallotField } from '../domain/model';
import {
  answerTo,
  buildBallot,
  optionIndexOf,
  questionResults,
  targetOf,
  targetOfChoices,
  toResults,
} from '../domain/rules';

const question: BallotField = {
  id: 'q1',
  kind: 'choice',
  label: 'Which model?',
  helper: 'Pick one',
  options: ['zk', 'optimistic', 'monolithic'],
  imageUrl: '',
};
const candidate = (id: string, label: string): BallotField => ({
  id,
  kind: 'candidate',
  label,
  helper: `About ${label}`,
  options: [],
  imageUrl: `https://img.example.com/${id}.png`,
});
const candidates = [
  candidate('c1', 'Aether'),
  candidate('c2', 'Nebula'),
  candidate('c3', 'Chronos'),
];

describe('buildBallot', () => {
  it('turns a poll question into numbered options', () => {
    const ballot = buildBallot('poll', [question]);
    expect(ballot.question).toBe('Which model?');
    expect(ballot.options.map((o) => [o.index, o.label])).toEqual([
      [0, 'zk'],
      [1, 'optimistic'],
      [2, 'monolithic'],
    ]);
  });

  it('turns candidates into numbered options with their picture', () => {
    const ballot = buildBallot('vote', candidates);
    expect(ballot.options).toHaveLength(3);
    expect(ballot.options[1]).toEqual({
      index: 1,
      label: 'Nebula',
      description: 'About Nebula',
      imageUrl: 'https://img.example.com/c2.png',
    });
  });

  it('is empty when the campaign has nothing to vote for', () => {
    expect(buildBallot('poll', []).options).toEqual([]);
    expect(buildBallot('vote', [question]).options).toEqual([]);
  });
});

describe('targetOf and optionIndexOf', () => {
  it('maps a poll option to its question and answer, and back', () => {
    const target = targetOf('poll', [question], 2);
    expect(target).toEqual({ fieldId: 'q1', choiceIndex: 2 });
    expect(optionIndexOf('poll', [question], target!)).toBe(2);
  });

  it('maps an image vote option to its candidate, and back', () => {
    const target = targetOf('vote', candidates, 1);
    expect(target).toEqual({ fieldId: 'c2', choiceIndex: null });
    expect(optionIndexOf('vote', candidates, target!)).toBe(1);
  });

  it('refuses an option that does not exist', () => {
    expect(targetOf('poll', [question], 3)).toBeNull();
    expect(targetOf('poll', [question], -1)).toBeNull();
    expect(targetOf('poll', [question], 1.5)).toBeNull();
    expect(targetOf('vote', candidates, 3)).toBeNull();
    expect(targetOf('poll', [], 0)).toBeNull();
  });

  it('forgets a candidate that is no longer on the campaign', () => {
    expect(optionIndexOf('vote', candidates, { fieldId: 'gone', choiceIndex: null })).toBeNull();
  });
});

describe('toResults', () => {
  it('counts votes per option and gives percentages that add up to 100', () => {
    const results = toResults('poll', [question], 3, [
      { fieldId: 'q1', choiceIndex: 0, votes: 1 },
      { fieldId: 'q1', choiceIndex: 1, votes: 1 },
      { fieldId: 'q1', choiceIndex: 2, votes: 1 },
    ]);
    expect(results.total).toBe(3);
    expect(results.options.map((o) => o.votes)).toEqual([1, 1, 1]);
    expect(results.options.reduce((sum, o) => sum + o.percent, 0)).toBe(100);
  });

  it('counts image votes by candidate, in option order', () => {
    const results = toResults('vote', candidates, 3, [
      { fieldId: 'c3', choiceIndex: null, votes: 22 },
      { fieldId: 'c1', choiceIndex: null, votes: 42 },
      { fieldId: 'c2', choiceIndex: null, votes: 36 },
    ]);
    expect(results.options.map((o) => [o.votes, o.percent])).toEqual([
      [42, 42],
      [36, 36],
      [22, 22],
    ]);
  });

  it('is all zeros before anyone has voted', () => {
    const results = toResults('poll', [question], 3, []);
    expect(results).toEqual({
      total: 0,
      options: [
        { index: 0, votes: 0, percent: 0 },
        { index: 1, votes: 0, percent: 0 },
        { index: 2, votes: 0, percent: 0 },
      ],
    });
  });

  it('ignores votes for an option that no longer exists', () => {
    const results = toResults('vote', candidates, 3, [
      { fieldId: 'gone', choiceIndex: null, votes: 5 },
      { fieldId: 'c1', choiceIndex: null, votes: 1 },
    ]);
    expect(results.total).toBe(1);
    expect(results.options[0]).toEqual({ index: 0, votes: 1, percent: 100 });
  });
});

describe('a poll with several questions', () => {
  const second: BallotField = {
    id: 'q2',
    kind: 'choice',
    label: 'Which chain?',
    helper: '',
    options: ['a', 'b'],
    imageUrl: '',
  };
  it('has one question per choice field, with the first repeated at the top', () => {
    const ballot = buildBallot('poll', [question, second]);
    expect(ballot.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(ballot.question).toBe('Which model?');
    expect(ballot.questions[1]!.options.map((o) => o.label)).toEqual(['a', 'b']);
  });
  it('needs one valid answer for every question', () => {
    expect(targetOfChoices('poll', [question, second], [2, 1])).toEqual({
      fieldId: 'q1',
      choiceIndex: 2,
      answers: { q1: 2, q2: 1 },
    });
    expect(targetOfChoices('poll', [question, second], [2])).toBeNull();
    expect(targetOfChoices('poll', [question, second], [0, 2])).toBeNull();
    expect(targetOfChoices('poll', [question, second], [0, -1])).toBeNull();
    expect(targetOfChoices('vote', candidates, [1])).toMatchObject({ fieldId: 'c2' });
    expect(targetOfChoices('vote', candidates, [0, 1])).toBeNull();
  });
  it('reads an old single-question vote as the answer to that question', () => {
    const old = { fieldId: 'q1', choiceIndex: 1, answers: {}, castAt: new Date() };
    expect(answerTo(old, 'q1')).toBe(1);
    expect(answerTo(old, 'q2')).toBeNull();
    expect(answerTo({ ...old, answers: { q1: 2, q2: 0 } }, 'q2')).toBe(0);
  });
  it('counts each question on its own rows', () => {
    const tally = [
      { fieldId: 'q1', choiceIndex: 0, votes: 3 },
      { fieldId: 'q2', choiceIndex: 1, votes: 3 },
    ];
    expect(
      questionResults('poll', [question, second], 0, tally).options.map((o) => o.votes),
    ).toEqual([3, 0, 0]);
    expect(
      questionResults('poll', [question, second], 1, tally).options.map((o) => o.votes),
    ).toEqual([0, 3]);
  });
});

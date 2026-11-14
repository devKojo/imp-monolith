import { describe, expect, it } from 'vitest';
import {
  attemptDeadline,
  firstProblem,
  isExpired,
  normalizeQuestions,
  questionProblem,
  scoreAttempt,
} from '../domain/rules';

const q = (over: Partial<{ prompt: string; options: string[]; correctIndex: number }> = {}) => ({
  prompt: 'Pick one',
  options: ['a', 'b', 'c'],
  correctIndex: 1,
  ...over,
});

describe('writing questions', () => {
  it('trims what was typed', () => {
    expect(normalizeQuestions([q({ prompt: '  Hi  ', options: [' a ', 'b '] })])).toEqual([
      { prompt: 'Hi', options: ['a', 'b'], correctIndex: 1 },
    ]);
  });

  it('accepts a question with 2 or more different answers and a correct one marked', () => {
    expect(questionProblem(q())).toBeNull();
    expect(questionProblem(q({ options: ['yes', 'no'], correctIndex: 0 }))).toBeNull();
  });

  it('says what is wrong, in words the author can act on', () => {
    expect(questionProblem(q({ prompt: '' }))).toMatch(/text/);
    expect(questionProblem(q({ options: ['only'] }))).toMatch(/at least 2/);
    expect(questionProblem(q({ options: ['a', ''] }))).toMatch(/empty/);
    expect(questionProblem(q({ options: ['Yes', 'yes'] }))).toMatch(/different/);
    expect(questionProblem(q({ correctIndex: 3 }))).toMatch(/correct/);
    expect(questionProblem(q({ correctIndex: -1 }))).toMatch(/correct/);
  });

  it('finds the first bad question and where it is', () => {
    expect(firstProblem([q(), q({ prompt: '' }), q({ options: ['x'] })])).toMatchObject({
      index: 1,
    });
    expect(firstProblem([q(), q()])).toBeNull();
  });
});

describe('scoring', () => {
  const marked = [
    { id: 'q1', correctIndex: 0 },
    { id: 'q2', correctIndex: 2 },
    { id: 'q3', correctIndex: 1 },
    { id: 'q4', correctIndex: 1 },
  ];

  it('counts correct answers; a question left unanswered scores nothing', () => {
    expect(scoreAttempt(marked, { q1: 0, q2: 2, q3: 0 }, 70)).toEqual({
      score: 2,
      total: 4,
      passed: false,
      passPercent: 70,
    });
  });

  it('passes at exactly the pass mark, not below it', () => {
    expect(scoreAttempt(marked, { q1: 0, q2: 2 }, 50).passed).toBe(true);
    expect(scoreAttempt(marked, { q1: 0 }, 50).passed).toBe(false);
    expect(scoreAttempt(marked, { q1: 0, q2: 2, q3: 1, q4: 1 }, 100).passed).toBe(true);
  });

  it('ignores answers to questions that are not in the quiz', () => {
    expect(scoreAttempt(marked, { gone: 0 }, 1).score).toBe(0);
  });

  it('cannot pass a quiz with no questions', () => {
    expect(scoreAttempt([], {}, 1).passed).toBe(false);
  });
});

describe('the clock', () => {
  const start = new Date('2026-11-14T10:00:00Z');
  const campaignEnd = new Date('2026-11-14T10:30:00Z');

  it('is the time limit from the moment the attempt started', () => {
    expect(attemptDeadline(start, { timeLimitMinutes: 10, passPercent: 70 }, campaignEnd)).toEqual(
      new Date('2026-11-14T10:10:00Z'),
    );
  });

  it('never runs past the end of the campaign', () => {
    expect(attemptDeadline(start, { timeLimitMinutes: 60, passPercent: 70 }, campaignEnd)).toEqual(
      campaignEnd,
    );
  });

  it('has no deadline of its own when untimed', () => {
    expect(
      attemptDeadline(start, { timeLimitMinutes: null, passPercent: 70 }, campaignEnd),
    ).toBeNull();
  });

  it('is expired at the deadline, not before', () => {
    const deadline = new Date('2026-11-14T10:10:00Z');
    expect(isExpired(deadline, new Date('2026-11-14T10:09:59Z'))).toBe(false);
    expect(isExpired(deadline, deadline)).toBe(true);
    expect(isExpired(null, deadline)).toBe(false);
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  answeredCount,
  buildSteps,
  missingIn,
  progressPercent,
  resumeIndex,
  stepOf,
} from './logic';
import type { QuestionKind, SurveyQuestion } from './types';

const q = (id: string, kind: QuestionKind, required = false): SurveyQuestion => ({
  id,
  kind,
  prompt: id,
  helper: '',
  required,
  options: kind === 'choice' ? ['a', 'b'] : [],
});

describe('buildSteps', () => {
  it('asks ratings that follow one another together, and everything else one at a time', () => {
    const steps = buildSteps([
      q('c1', 'choice'),
      q('r1', 'likert'),
      q('r2', 'likert'),
      q('t1', 'text'),
      q('r3', 'likert'),
    ]);
    expect(steps.map((s) => [s.kind, s.questions.map((x) => x.id)])).toEqual([
      ['single', ['c1']],
      ['matrix', ['r1', 'r2']],
      ['single', ['t1']],
      ['matrix', ['r3']],
    ]);
  });

  it('has no steps for no questions', () => {
    expect(buildSteps([])).toEqual([]);
  });
});

describe('progress through the steps', () => {
  const questions = [
    q('c1', 'choice', true),
    q('r1', 'likert', true),
    q('r2', 'likert'),
    q('t', 'text'),
  ];
  const steps = buildSteps(questions);
  const c1 = { choiceIndex: 0 };

  it('lists the required questions still open on a screen', () => {
    expect(missingIn(steps[1]!, {}).map((x) => x.id)).toEqual(['r1']);
    expect(missingIn(steps[1]!, { r1: { choiceIndex: 0 } })).toEqual([]);
  });

  it('resumes at the first required question left open, else the first unanswered, else the start', () => {
    expect(resumeIndex(steps, {})).toBe(0);
    expect(resumeIndex(steps, { c1 })).toBe(1);
    expect(resumeIndex(steps, { c1, r1: { choiceIndex: 2 } })).toBe(1);
    expect(resumeIndex(steps, { c1, r1: { choiceIndex: 2 }, r2: { choiceIndex: 1 } })).toBe(2);
    expect(
      resumeIndex(steps, { c1, r1: { choiceIndex: 2 }, r2: { choiceIndex: 1 }, t: { text: 'x' } }),
    ).toBe(0);
  });

  it('finds the screen of a question, and counts answers', () => {
    expect(stepOf(steps, ['r2'])).toBe(1);
    expect(stepOf(steps, ['nope'])).toBe(-1);
    expect(answeredCount(questions, { c1, t: { text: 'x' } })).toBe(2);
  });

  it('reports progress as the share of screens passed', () => {
    expect(progressPercent(0, 4)).toBe(0);
    expect(progressPercent(2, 4)).toBe(50);
    expect(progressPercent(0, 0)).toBe(0);
  });
});

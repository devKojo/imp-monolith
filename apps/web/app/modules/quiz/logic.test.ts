// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  addAnswer,
  addQuestion,
  answeredCount,
  emptyQuiz,
  firstProblem,
  fromDefinition,
  listState,
  moveQuestion,
  newQuestion,
  parsePassPercent,
  parseTimeLimit,
  questionProblem,
  removeAnswer,
  removeQuestion,
  resumeIndex,
  secondsRemaining,
  setAnswer,
  toSaveBody,
  totalSeconds,
  unanswered,
  updateQuestion,
} from './logic';
import type { QuestionDraft } from './types';

const q = (uid: string, over: Partial<QuestionDraft> = {}): QuestionDraft => ({
  uid,
  prompt: `Question ${uid}`,
  options: ['a', 'b', 'c'],
  correctIndex: 1,
  ...over,
});

describe('writing a quiz', () => {
  it('starts a question with two empty answers and none marked correct', () => {
    expect(newQuestion('x')).toEqual({ uid: 'x', prompt: '', options: ['', ''], correctIndex: -1 });
  });

  it('adds, moves, updates and removes questions without touching the input', () => {
    const all = [q('1'), q('2'), q('3')];
    expect(moveQuestion(all, '2', -1).map((x) => x.uid)).toEqual(['2', '1', '3']);
    expect(moveQuestion(all, '1', -1).map((x) => x.uid)).toEqual(['1', '2', '3']);
    expect(moveQuestion(all, '3', 1).map((x) => x.uid)).toEqual(['1', '2', '3']);
    expect(updateQuestion(all, '2', { prompt: 'New' })[1]!.prompt).toBe('New');
    expect(removeQuestion(all, '2').map((x) => x.uid)).toEqual(['1', '3']);
    expect(all.map((x) => x.uid)).toEqual(['1', '2', '3']);
  });

  it('stops adding at the limit', () => {
    const full = Array.from({ length: LIMITS.questions }, (_, i) => q(String(i)));
    expect(addQuestion(full, q('more'))).toHaveLength(LIMITS.questions);
    expect(addQuestion([q('1')], q('2'))).toHaveLength(2);
  });

  it('adds answers up to six and removes down to two', () => {
    let question = q('1', { options: ['a', 'b'], correctIndex: 0 });
    for (let i = 0; i < 10; i++) question = addAnswer(question);
    expect(question.options).toHaveLength(LIMITS.optionsMax);
    expect(removeAnswer(q('1', { options: ['a', 'b'] }), 0).options).toEqual(['a', 'b']);
  });

  it('keeps the correct mark on its answer when an answer is removed', () => {
    const base = q('1', { options: ['a', 'b', 'c', 'd'], correctIndex: 2 });
    expect(removeAnswer(base, 0)).toMatchObject({ options: ['b', 'c', 'd'], correctIndex: 1 });
    expect(removeAnswer(base, 3)).toMatchObject({ options: ['a', 'b', 'c'], correctIndex: 2 });
    expect(removeAnswer(base, 2)).toMatchObject({ options: ['a', 'b', 'd'], correctIndex: -1 });
  });

  it('edits one answer', () => {
    expect(setAnswer(q('1'), 1, 'z').options).toEqual(['a', 'z', 'c']);
  });

  it('names the first problem, as the server will', () => {
    expect(questionProblem(q('1'))).toBeNull();
    expect(questionProblem(q('1', { prompt: '  ' }))).toBe('prompt');
    expect(questionProblem(q('1', { options: ['a', ''] }))).toBe('empty');
    expect(questionProblem(q('1', { options: ['Yes', ' yes '] }))).toBe('different');
    expect(questionProblem(q('1', { correctIndex: -1 }))).toBe('correct');
    expect(questionProblem(q('1', { correctIndex: 3 }))).toBe('correct');
    expect(firstProblem([q('1'), q('2', { correctIndex: -1 })])).toEqual({
      index: 1,
      problem: 'correct',
    });
    expect(firstProblem([q('1')])).toBeNull();
  });

  it('sends trimmed text and no editor keys', () => {
    const body = toSaveBody({
      timeLimitMinutes: 10,
      passPercent: 80,
      questions: [q('1', { prompt: ' Hi ', options: [' a ', 'b '], correctIndex: 0 })],
    });
    expect(body).toEqual({
      timeLimitMinutes: 10,
      passPercent: 80,
      questions: [{ prompt: 'Hi', options: ['a', 'b'], correctIndex: 0 }],
    });
  });

  it('reads the number fields: empty is no limit, and values stay in range', () => {
    expect(parseTimeLimit('')).toBeNull();
    expect(parseTimeLimit('0')).toBeNull();
    expect(parseTimeLimit('15')).toBe(15);
    expect(parseTimeLimit('999')).toBe(LIMITS.timeLimitMax);
    expect(parsePassPercent('', 70)).toBe(70);
    expect(parsePassPercent('0', 70)).toBe(1);
    expect(parsePassPercent('150', 70)).toBe(100);
    expect(parsePassPercent('85', 70)).toBe(85);
  });

  it('turns what the server stores into an editable draft with its own keys', () => {
    let n = 0;
    const draft = fromDefinition(
      {
        settings: { timeLimitMinutes: null, passPercent: 60 },
        questions: [{ id: 'srv', prompt: 'P', options: ['a', 'b'], correctIndex: 1 }],
      },
      () => `k${++n}`,
    );
    expect(draft).toEqual({
      timeLimitMinutes: null,
      passPercent: 60,
      questions: [{ uid: 'k1', prompt: 'P', options: ['a', 'b'], correctIndex: 1 }],
    });
    expect(emptyQuiz().questions).toEqual([]);
  });
});

describe('the clock', () => {
  const view = { expiresAt: '2026-11-14T10:10:00.000Z', serverTime: '2026-11-14T10:00:00.000Z' };

  it('counts down from the server time, using only the device time that has passed', () => {
    expect(secondsRemaining(view, 1_000_000, 1_000_000)).toBe(600);
    expect(secondsRemaining(view, 1_000_000, 1_000_000 + 90_000)).toBe(510);
  });

  it('is not fooled by a device clock that is hours off', () => {
    // The device thinks it is a different day; only the elapsed time matters.
    expect(secondsRemaining(view, 9_999_999_999, 9_999_999_999 + 60_000)).toBe(540);
  });

  it('stops at zero and has no clock when untimed', () => {
    expect(secondsRemaining(view, 0, 10 * 3_600_000)).toBe(0);
    expect(secondsRemaining({ expiresAt: null, serverTime: view.serverTime }, 0, 5)).toBeNull();
  });

  it('knows how long the whole attempt is', () => {
    expect(totalSeconds({ startedAt: '2026-11-14T10:00:00.000Z', expiresAt: view.expiresAt })).toBe(
      600,
    );
    expect(totalSeconds({ startedAt: '2026-11-14T10:00:00.000Z', expiresAt: null })).toBe(0);
  });
});

describe('progress', () => {
  const questions = [
    { id: 'a', prompt: '1', options: ['x', 'y'] },
    { id: 'b', prompt: '2', options: ['x', 'y'] },
    { id: 'c', prompt: '3', options: ['x', 'y'] },
  ];

  it('counts what is answered, including a first option (index 0)', () => {
    const v = { questions, answers: { a: 0, c: 1 } };
    expect(answeredCount(v)).toBe(2);
    expect(unanswered(v)).toBe(1);
  });

  it('resumes at the first unanswered question, or the last when all are answered', () => {
    expect(resumeIndex({ questions, answers: { a: 0 } })).toBe(1);
    expect(resumeIndex({ questions, answers: { a: 0, b: 0, c: 0 } })).toBe(2);
    expect(resumeIndex({ questions: [], answers: {} })).toBe(0);
  });

  it('labels each question in the list', () => {
    const answers = { a: 0 };
    expect(listState(questions[0]!, 0, 1, answers)).toBe('answered');
    expect(listState(questions[1]!, 1, 1, answers)).toBe('current');
    expect(listState(questions[2]!, 2, 1, answers)).toBe('open');
  });
});

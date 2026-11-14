// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  answeredCount,
  listState,
  resumeIndex,
  secondsRemaining,
  totalSeconds,
  unanswered,
} from './logic';

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

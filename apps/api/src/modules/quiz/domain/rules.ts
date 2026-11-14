import type { AttemptResult, Question, QuizSettings } from './model';

/** Pure rules for quizzes: no I/O and no clock of their own. */

/** When an attempt that started at `startedAt` must be over: the time limit, never past the campaign. */
export function attemptDeadline(
  startedAt: Date,
  settings: QuizSettings,
  campaignEnd: Date,
): Date | null {
  if (settings.timeLimitMinutes === null) return null;
  const limit = new Date(startedAt.getTime() + settings.timeLimitMinutes * 60_000);
  return limit < campaignEnd ? limit : campaignEnd;
}

/** Marks the answers. A question left unanswered scores nothing; passing is a percentage of all questions. */
export function scoreAttempt(
  questions: readonly Pick<Question, 'id' | 'correctIndex'>[],
  answers: Readonly<Record<string, number>>,
  passPercent: number,
): AttemptResult {
  const total = questions.length;
  const score = questions.filter((q) => answers[q.id] === q.correctIndex).length;
  return { score, total, passed: total > 0 && score * 100 >= passPercent * total, passPercent };
}

export const isExpired = (expiresAt: Date | null, now: Date): boolean =>
  expiresAt !== null && now >= expiresAt;

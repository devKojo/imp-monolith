import {
  LIMITS,
  type AttemptResult,
  type Question,
  type QuestionInput,
  type QuizSettings,
} from './model';

/** Pure rules for quizzes: no I/O and no clock of their own. */

/** Trim what the business typed, so equal input is stored the same way. */
export const normalizeQuestions = (questions: readonly QuestionInput[]): QuestionInput[] =>
  questions.map((q) => ({
    prompt: q.prompt.trim(),
    options: q.options.map((o) => o.trim()),
    correctIndex: q.correctIndex,
  }));

/** Why a question cannot be saved, or null. Messages are for the person writing the quiz. */
export function questionProblem(q: QuestionInput): string | null {
  if (q.prompt === '') return 'Every question needs text';
  if (q.options.length < LIMITS.optionsMin) return 'Every question needs at least 2 answers';
  if (q.options.some((o) => o === '')) return 'Answers cannot be empty';
  const lower = q.options.map((o) => o.toLowerCase());
  if (new Set(lower).size !== lower.length) return 'Answers must be different from each other';
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
    return 'Mark which answer is correct';
  }
  return null;
}

/** The first problem across the questions, with its position, or null. */
export function firstProblem(
  questions: readonly QuestionInput[],
): { index: number; message: string } | null {
  for (const [index, q] of questions.entries()) {
    const message = questionProblem(q);
    if (message) return { index, message };
  }
  return null;
}

/** When an attempt that started at `startedAt` must be over: the time limit, never past the campaign. */
export function attemptDeadline(
  startedAt: Date,
  settings: QuizSettings,
  campaignEnd: Date,
): Date | null {
  const limit =
    settings.timeLimitMinutes === null
      ? null
      : new Date(startedAt.getTime() + settings.timeLimitMinutes * 60_000);
  if (limit === null) return null;
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

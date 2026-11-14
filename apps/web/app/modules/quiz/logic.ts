import type {
  AttemptView,
  QuestionDraft,
  QuizDefinition,
  QuizDraft,
  PublicQuestion,
} from './types';

/** The API's limits, so the form stops people before the server has to. */
export const LIMITS = {
  questions: 50,
  prompt: 300,
  option: 120,
  optionsMin: 2,
  optionsMax: 6,
  timeLimitMax: 240,
  defaultPassPercent: 70,
} as const;

// ---- writing a quiz (the business) -----------------------------------------------------------

export const newQuestion = (uid: string): QuestionDraft => ({
  uid,
  prompt: '',
  options: ['', ''],
  correctIndex: -1,
});

export const emptyQuiz = (): QuizDraft => ({
  timeLimitMinutes: null,
  passPercent: LIMITS.defaultPassPercent,
  questions: [],
});

export const fromDefinition = (def: QuizDefinition, uid: () => string): QuizDraft => ({
  timeLimitMinutes: def.settings.timeLimitMinutes,
  passPercent: def.settings.passPercent,
  questions: def.questions.map((q) => ({
    uid: uid(),
    prompt: q.prompt,
    options: [...q.options],
    correctIndex: q.correctIndex,
  })),
});

export const addQuestion = (qs: readonly QuestionDraft[], q: QuestionDraft): QuestionDraft[] =>
  qs.length >= LIMITS.questions ? [...qs] : [...qs, q];

export const removeQuestion = (qs: readonly QuestionDraft[], uid: string): QuestionDraft[] =>
  qs.filter((q) => q.uid !== uid);

export function moveQuestion(
  qs: readonly QuestionDraft[],
  uid: string,
  direction: -1 | 1,
): QuestionDraft[] {
  const from = qs.findIndex((q) => q.uid === uid);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= qs.length) return [...qs];
  const next = [...qs];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export const updateQuestion = (
  qs: readonly QuestionDraft[],
  uid: string,
  patch: Partial<Omit<QuestionDraft, 'uid'>>,
): QuestionDraft[] => qs.map((q) => (q.uid === uid ? { ...q, ...patch } : q));

/** Adds an empty answer, up to the limit. */
export const addAnswer = (q: QuestionDraft): QuestionDraft =>
  q.options.length >= LIMITS.optionsMax ? q : { ...q, options: [...q.options, ''] };

/**
 * Removes an answer, keeping at least two. The correct mark follows its answer: removing the correct
 * one clears it, removing an earlier one moves it up.
 */
export function removeAnswer(q: QuestionDraft, index: number): QuestionDraft {
  if (q.options.length <= LIMITS.optionsMin) return q;
  const correctIndex =
    q.correctIndex === index ? -1 : q.correctIndex > index ? q.correctIndex - 1 : q.correctIndex;
  return { ...q, options: q.options.filter((_, i) => i !== index), correctIndex };
}

export const setAnswer = (q: QuestionDraft, index: number, text: string): QuestionDraft => ({
  ...q,
  options: q.options.map((o, i) => (i === index ? text : o)),
});

export type QuestionProblem = 'prompt' | 'answers' | 'empty' | 'different' | 'correct';

/** The first thing wrong with a question, mirrored from the server so the form can say so early. */
export function questionProblem(q: QuestionDraft): QuestionProblem | null {
  if (q.prompt.trim() === '') return 'prompt';
  const options = q.options.map((o) => o.trim());
  if (options.length < LIMITS.optionsMin) return 'answers';
  if (options.some((o) => o === '')) return 'empty';
  const lower = options.map((o) => o.toLowerCase());
  if (new Set(lower).size !== lower.length) return 'different';
  if (q.correctIndex < 0 || q.correctIndex >= options.length) return 'correct';
  return null;
}

export function firstProblem(
  qs: readonly QuestionDraft[],
): { index: number; problem: QuestionProblem } | null {
  for (const [index, q] of qs.entries()) {
    const problem = questionProblem(q);
    if (problem) return { index, problem };
  }
  return null;
}

/** What a save sends: trimmed text, and no editor-only keys. */
export const toSaveBody = (quiz: QuizDraft) => ({
  timeLimitMinutes: quiz.timeLimitMinutes,
  passPercent: quiz.passPercent,
  questions: quiz.questions.map((q) => ({
    prompt: q.prompt.trim(),
    options: q.options.map((o) => o.trim()),
    correctIndex: q.correctIndex,
  })),
});

/** The number field gives text; empty means no limit, anything else is a whole number in range. */
export function parseTimeLimit(text: string): number | null {
  const n = Math.floor(Number(text.trim()));
  if (text.trim() === '' || !Number.isFinite(n) || n < 1) return null;
  return Math.min(n, LIMITS.timeLimitMax);
}

export function parsePassPercent(text: string, fallback: number): number {
  const n = Math.floor(Number(text.trim()));
  if (text.trim() === '' || !Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, n));
}

// ---- taking a quiz (the participant) ---------------------------------------------------------

/** Whole seconds left, measured on the server's clock: the device clock only supplies the elapsed time. */
export function secondsRemaining(
  view: Pick<AttemptView, 'expiresAt' | 'serverTime'>,
  receivedAtMs: number,
  nowMs: number,
): number | null {
  if (!view.expiresAt) return null;
  const serverNow = Date.parse(view.serverTime) + (nowMs - receivedAtMs);
  return Math.max(0, Math.ceil((Date.parse(view.expiresAt) - serverNow) / 1000));
}

export const totalSeconds = (view: Pick<AttemptView, 'startedAt' | 'expiresAt'>): number =>
  view.expiresAt
    ? Math.max(1, Math.round((Date.parse(view.expiresAt) - Date.parse(view.startedAt)) / 1000))
    : 0;

export const answeredCount = (view: Pick<AttemptView, 'questions' | 'answers'>): number =>
  view.questions.filter((q) => view.answers[q.id] !== undefined).length;

/** Where to resume: the first question without an answer, or the last one when all are answered. */
export function resumeIndex(view: Pick<AttemptView, 'questions' | 'answers'>): number {
  const first = view.questions.findIndex((q) => view.answers[q.id] === undefined);
  return first === -1 ? Math.max(0, view.questions.length - 1) : first;
}

export type ListState = 'answered' | 'current' | 'open';
export const listState = (
  q: PublicQuestion,
  index: number,
  current: number,
  answers: Readonly<Record<string, number>>,
): ListState => (index === current ? 'current' : answers[q.id] !== undefined ? 'answered' : 'open');

export const unanswered = (view: Pick<AttemptView, 'questions' | 'answers'>): number =>
  view.questions.length - answeredCount(view);

import type { AttemptView, PublicQuestion } from './types';

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

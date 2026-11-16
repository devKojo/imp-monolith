import type { Answers, SurveyQuestion } from './types';

/**
 * One screen of the survey. Ratings that follow one another are asked together as a matrix (statements
 * on a shared scale); every other question is a screen of its own.
 */
export type Step =
  | { kind: 'matrix'; id: string; questions: SurveyQuestion[] }
  | { kind: 'single'; id: string; questions: [SurveyQuestion] };

export function buildSteps(questions: readonly SurveyQuestion[]): Step[] {
  const steps: Step[] = [];
  for (const q of questions) {
    const last = steps[steps.length - 1];
    if (q.kind === 'likert' && last?.kind === 'matrix') last.questions.push(q);
    else if (q.kind === 'likert') steps.push({ kind: 'matrix', id: q.id, questions: [q] });
    else steps.push({ kind: 'single', id: q.id, questions: [q] });
  }
  return steps;
}

export const isAnswered = (q: Pick<SurveyQuestion, 'id'>, answers: Readonly<Answers>): boolean =>
  answers[q.id] !== undefined;

/** The required questions on a screen that have no answer yet. */
export const missingIn = (step: Step, answers: Readonly<Answers>): SurveyQuestion[] =>
  step.questions.filter((q) => q.required && !isAnswered(q, answers));

/** Index of the first screen holding any of the given question ids, or -1. */
export const stepOf = (steps: readonly Step[], ids: readonly string[]): number =>
  steps.findIndex((s) => s.questions.some((q) => ids.includes(q.id)));

/**
 * Where to resume: the first screen with a required question still open, else the first with any
 * question open, else the first screen.
 */
export function resumeIndex(steps: readonly Step[], answers: Readonly<Answers>): number {
  const required = steps.findIndex((s) => missingIn(s, answers).length > 0);
  if (required !== -1) return required;
  const open = steps.findIndex((s) => s.questions.some((q) => !isAnswered(q, answers)));
  return open === -1 ? 0 : open;
}

export const answeredCount = (questions: readonly SurveyQuestion[], answers: Readonly<Answers>) =>
  questions.filter((q) => isAnswered(q, answers)).length;

/** Share of screens passed, for the progress bar: the first screen is 0%. */
export const progressPercent = (index: number, total: number): number =>
  total === 0 ? 0 : Math.round((index / total) * 100);

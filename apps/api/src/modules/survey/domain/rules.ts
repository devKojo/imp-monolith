import {
  LIKERT_POINTS,
  TEXT_LIMITS,
  type AnswerValue,
  type Answers,
  type SurveyQuestion,
} from './model';

/** Pure rules for surveys: no I/O and no clock of their own. */

/** Rough seconds a participant needs for one question, by kind. */
const SECONDS: Record<SurveyQuestion['kind'], number> = {
  choice: 15,
  likert: 15,
  text: 45,
  long_text: 90,
};

/** Whole minutes to show as the estimate, never less than one. */
export const estimatedMinutes = (questions: readonly Pick<SurveyQuestion, 'kind'>[]): number =>
  Math.max(1, Math.ceil(questions.reduce((sum, q) => sum + SECONDS[q.kind], 0) / 60));

/**
 * Checks an answer against its question and returns it in the form that is stored, or null when it does
 * not belong to the question. Written text is trimmed; an answer that is empty after trimming is
 * `'clear'`, meaning "take my answer back" (only text questions can be cleared).
 */
export function normalizeAnswer(
  question: Pick<SurveyQuestion, 'kind' | 'options'>,
  input: { choiceIndex?: number; text?: string },
): AnswerValue | 'clear' | null {
  switch (question.kind) {
    case 'choice':
    case 'likert': {
      const limit = question.kind === 'likert' ? LIKERT_POINTS : question.options.length;
      const i = input.choiceIndex;
      return input.text === undefined && Number.isInteger(i) && i! >= 0 && i! < limit
        ? { choiceIndex: i! }
        : null;
    }
    case 'text':
    case 'long_text': {
      if (input.choiceIndex !== undefined || input.text === undefined) return null;
      const text = input.text.trim();
      if (text === '') return 'clear';
      return text.length <= TEXT_LIMITS[question.kind] ? { text } : null;
    }
  }
}

/** The required questions that have no answer yet, in question order. */
export const missingRequired = (
  questions: readonly Pick<SurveyQuestion, 'id' | 'required'>[],
  answers: Readonly<Answers>,
): string[] => questions.filter((q) => q.required && answers[q.id] === undefined).map((q) => q.id);

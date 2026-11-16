/** The kinds of question a survey asks. A rating is a fixed scale of five points. */
export type QuestionKind = 'choice' | 'likert' | 'text' | 'long_text';

export type SurveyQuestion = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  helper: string;
  required: boolean;
  /** The options of a choice question; empty for every other kind. */
  options: string[];
};

/** One answer: a chosen option (or rating point, counted from 0) or written text. */
export type AnswerValue = { choiceIndex?: number; text?: string };
export type Answers = Record<string, AnswerValue>;

export type ResponseView = {
  id: string;
  startedAt: string;
  /** Set once the response is submitted; answers can no longer change. */
  submittedAt: string | null;
  questions: SurveyQuestion[];
  answers: Answers;
};

/** What a visitor may know before starting. */
export type SurveyInfo = {
  slug: string;
  title: string;
  businessName: string;
  endsAt: string;
  questionCount: number;
  requiredCount: number;
  estimatedMinutes: number;
};

/** Number of points on a rating, from lowest to highest. */
export const LIKERT_POINTS = 5;

/**
 * Surveys: a participant's response to the questions written on a survey campaign. The questions are the
 * campaign's own content fields (choice, rating, short and long text); this module only reads them.
 */
export type QuestionKind = 'choice' | 'likert' | 'text' | 'long_text';

/** A rating is a fixed scale of five points, answered as 0 to 4 and shown as 1 to 5. */
export const LIKERT_POINTS = 5;

/** Longest written answer, by kind. */
export const TEXT_LIMITS = { text: 500, long_text: 4000 } as const;

export type SurveyQuestion = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  helper: string;
  required: boolean;
  /** The options of a choice question; empty for every other kind. */
  options: string[];
};

/** What a participant gave for one question: a chosen option (or rating point), or written text. */
export type AnswerValue =
  { choiceIndex: number; text?: never } | { text: string; choiceIndex?: never };
export type Answers = Record<string, AnswerValue>;

/** A response as stored, with the answers given so far (question id to answer). */
export type ResponseRow = {
  id: string;
  startedAt: Date;
  submittedAt: Date | null;
  answers: Answers;
};

/** What the participant app renders. */
export type ResponseView = {
  id: string;
  startedAt: string;
  submittedAt: string | null;
  questions: SurveyQuestion[];
  answers: Answers;
};

/** A running survey campaign found by its public address. */
export type RunnableSurvey = {
  campaignId: string;
  tenantId: string;
  title: string;
  businessName: string;
  endAt: Date;
};

export type SurveyInfo = {
  slug: string;
  title: string;
  businessName: string;
  endsAt: string;
  questionCount: number;
  requiredCount: number;
  estimatedMinutes: number;
};

/** The signed-in participant. */
export type Participant = { userId: string; accountType: string };

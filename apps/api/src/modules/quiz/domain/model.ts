/**
 * Quizzes: single-choice questions on a campaign, and a participant's attempt at them. The questions
 * (with their correct answers) belong to the business; a participant only ever receives the prompt
 * and the options.
 */
export const LIMITS = {
  questionsMax: 50,
  promptMax: 300,
  optionMax: 120,
  optionsMin: 2,
  optionsMax: 6,
  timeLimitMax: 240,
  defaultPassPercent: 70,
} as const;

/** What the business writes for one question; `id` is assigned by the server. */
export type QuestionInput = { prompt: string; options: string[]; correctIndex: number };
export type Question = QuestionInput & { id: string };

export type QuizSettings = {
  /** Minutes for the whole attempt; null means untimed. */
  timeLimitMinutes: number | null;
  passPercent: number;
};
export type QuizDefinition = { settings: QuizSettings; questions: Question[] };

/** A question as a participant sees it: never the correct answer. */
export type PublicQuestion = { id: string; prompt: string; options: string[] };

export type AttemptResult = { score: number; total: number; passed: boolean; passPercent: number };

/** An attempt as stored, with the choices made so far (question id to option index). */
export type AttemptRow = {
  id: string;
  startedAt: Date;
  expiresAt: Date | null;
  submittedAt: Date | null;
  score: number | null;
  total: number | null;
  passed: boolean | null;
  answers: Record<string, number>;
};

/** What the participant app renders. `serverTime` lets the client correct for a wrong device clock. */
export type AttemptView = {
  id: string;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  serverTime: string;
  questions: PublicQuestion[];
  answers: Record<string, number>;
  result: AttemptResult | null;
};

/** A running quiz campaign found by its public address. */
export type RunnableQuiz = {
  campaignId: string;
  tenantId: string;
  title: string;
  businessName: string;
  endAt: Date;
};

export type QuizInfo = {
  slug: string;
  title: string;
  businessName: string;
  endsAt: string;
  questionCount: number;
  timeLimitMinutes: number | null;
  passPercent: number;
};

/** The campaign facts the authoring side needs: is it a draft, and is it a quiz. */
export type CampaignFacts = { status: string; archetype: string | null };

/** The signed-in business user acting on a campaign's quiz, resolved by the session. */
export type Actor = { userId: string; tenantId: string; role: string };
/** The signed-in participant. */
export type Participant = { userId: string; accountType: string };

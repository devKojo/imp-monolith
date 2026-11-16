/**
 * Quizzes: a participant's attempt at the questions of a quiz campaign. The questions (with their correct
 * answers) and the settings are written on the campaign by the business; here a participant only ever
 * receives the prompt and the options.
 */
export type Question = { id: string; prompt: string; options: string[]; correctIndex: number };

export type QuizSettings = {
  /** Minutes for the whole attempt; null means untimed. */
  timeLimitMinutes: number | null;
  passPercent: number;
  /** Attempts a participant may make; one means no retake. */
  maxAttempts: number;
};
export type QuizDefinition = { settings: QuizSettings; questions: Question[] };

/** A question as a participant sees it: never the correct answer. */
export type PublicQuestion = { id: string; prompt: string; options: string[] };

export type AttemptResult = { score: number; total: number; passed: boolean; passPercent: number };

/** An attempt as stored, with the choices made so far (question id to option index). */
export type AttemptRow = {
  id: string;
  /** 1 for the first attempt, 2 for the first retake, and so on. */
  attemptNumber: number;
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
  attemptNumber: number;
  /** Attempts allowed in all; a retake is possible while `attemptNumber` is below it. */
  maxAttempts: number;
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
  maxAttempts: number;
};

/** The signed-in participant. */
export type Participant = { userId: string; accountType: string };

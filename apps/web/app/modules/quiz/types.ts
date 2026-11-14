/** What the participant sees: a question has a prompt and options, never the correct answer. */
export type PublicQuestion = { id: string; prompt: string; options: string[] };

export type AttemptResult = { score: number; total: number; passed: boolean; passPercent: number };

export type AttemptView = {
  id: string;
  startedAt: string;
  /** When the attempt ends by itself; null for an untimed quiz. */
  expiresAt: string | null;
  submittedAt: string | null;
  /** The server's clock when this was sent, so the countdown does not trust the device clock. */
  serverTime: string;
  questions: PublicQuestion[];
  /** Question id to the index of the chosen option. */
  answers: Record<string, number>;
  result: AttemptResult | null;
};

/** What a visitor may know before starting. */
export type QuizInfo = {
  slug: string;
  title: string;
  businessName: string;
  endsAt: string;
  questionCount: number;
  timeLimitMinutes: number | null;
  passPercent: number;
};

/** The public face of a running campaign, for its page (/c/{slug}). */
export type PublicCampaignPage = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  businessName: string;
  type: string;
  endsAt: string;
};

/** A question as the business writes it. `uid` is only a stable key for the editor. */
export type QuestionDraft = {
  uid: string;
  prompt: string;
  options: string[];
  /** Index of the correct answer; -1 until one is marked. */
  correctIndex: number;
};

export type QuizDraft = {
  /** Minutes for the whole attempt; null for no limit. */
  timeLimitMinutes: number | null;
  passPercent: number;
  questions: QuestionDraft[];
};

/** What the API stores and returns for the business. */
export type QuizDefinition = {
  settings: { timeLimitMinutes: number | null; passPercent: number };
  questions: Array<{ id: string; prompt: string; options: string[]; correctIndex: number }>;
};

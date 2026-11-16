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

/** One prize tier as the public page shows it. */
export type PublicPrizeTier = {
  name: string;
  valueLabel: string;
  winners: number;
  description: string;
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
  startsAt: string | null;
  prizes: PublicPrizeTier[];
};

/** A poll or an image vote as the API returns it (apps/api modules/voting). */
export type BallotKind = 'poll' | 'vote';

/** One thing a participant can vote for, numbered from 0 in the order the business wrote them. */
export type BallotOption = {
  index: number;
  label: string;
  /** A candidate's description; empty for a poll answer. */
  description: string;
  /** A candidate's picture (an https link); empty for a poll answer. */
  imageUrl: string;
};

/** One question of a ballot: a poll question, or an image vote's whole list of candidates. */
export type BallotQuestion = {
  id: string;
  /** The question's text; empty for an image vote. */
  question: string;
  helper: string;
  options: BallotOption[];
};

export type QuestionView = BallotQuestion & {
  /** The participant's answer, once voted; null before. */
  choice: number | null;
  /** The standings of this question when the campaign lets this participant see them; otherwise null. */
  results: Results | null;
};

export type OptionResult = { index: number; votes: number; percent: number };
export type Results = { total: number; options: OptionResult[] };

/** What a visitor may know before signing in: never the standings. */
export type BallotInfo = {
  slug: string;
  kind: BallotKind;
  title: string;
  businessName: string;
  endsAt: string;
  question: string;
  optionCount: number;
  /** How many questions it asks: one for an image vote. */
  questionCount: number;
};

export type BallotView = {
  slug: string;
  kind: BallotKind;
  title: string;
  summary: string;
  businessName: string;
  endsAt: string;
  /** A poll's question; empty for an image vote. */
  question: string;
  helper: string;
  options: BallotOption[];
  /** The participant's own vote, once cast. */
  vote: { optionIndex: number; castAt: string } | null;
  /** The standings, when the campaign lets this participant see them; otherwise null. */
  results: Results | null;
  /** Every question with the participant's answer and its standings; the fields above are the first one's. */
  questions: QuestionView[];
  /** When the participant voted; null before. */
  castAt: string | null;
};

/** How one campaign stands, for the business that runs it. */
export type CampaignResults = {
  campaignId: string;
  kind: BallotKind;
  title: string;
  question: string;
  total: number;
  options: Array<BallotOption & { votes: number; percent: number }>;
  /** Every question's standings; the fields above are the first one's. */
  questions: Array<{
    id: string;
    question: string;
    total: number;
    options: Array<BallotOption & { votes: number; percent: number }>;
  }>;
};

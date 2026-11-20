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
};

/** How one campaign stands, for the business that runs it. */
export type CampaignResults = {
  campaignId: string;
  kind: BallotKind;
  title: string;
  question: string;
  total: number;
  options: Array<BallotOption & { votes: number; percent: number }>;
};

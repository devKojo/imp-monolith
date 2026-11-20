/**
 * Voting: a participant casts one vote in a poll (one question, a few answers) or an image vote (candidates
 * with a picture each). Both are the same act: pick one option, once. The options are written on the
 * campaign by the business as content fields of the `campaigns` module (a poll's question, or the
 * candidates); this module only reads them.
 */
export type BallotKind = 'poll' | 'vote';

/** When people may see how it stands; the business sets it on the campaign. */
export type ResultsVisibility = 'after_vote' | 'live';

/** A content field as the voting side reads it. */
export type BallotField = {
  id: string;
  kind: 'choice' | 'candidate';
  label: string;
  helper: string;
  /** The answers of a poll's question; empty for a candidate. */
  options: string[];
  /** A candidate's picture; empty for a poll's question. */
  imageUrl: string;
};

/** One thing a participant can vote for, numbered from 0 in the order the business wrote them. */
export type BallotOption = {
  index: number;
  label: string;
  /** A candidate's description; empty for a poll answer. */
  description: string;
  /** A candidate's picture (an https link); empty for a poll answer. */
  imageUrl: string;
};

/** What the options are, built from the campaign's fields. */
export type Ballot = {
  kind: BallotKind;
  /** A poll's question; empty for an image vote (the campaign's own title asks it). */
  question: string;
  helper: string;
  options: BallotOption[];
};

/** A running poll or image vote campaign found by its public address. */
export type RunnableBallot = {
  campaignId: string;
  tenantId: string;
  kind: BallotKind;
  title: string;
  summary: string;
  businessName: string;
  endAt: Date;
  showResults: ResultsVisibility;
};

/** A vote as stored: the field chosen (a poll's question or a candidate) and, for a poll, the answer. */
export type StoredVote = { fieldId: string; choiceIndex: number | null; castAt: Date };

/** Votes counted per stored target. */
export type TallyRow = { fieldId: string; choiceIndex: number | null; votes: number };

export type OptionResult = { index: number; votes: number; percent: number };
export type Results = { total: number; options: OptionResult[] };

/** What the participant app renders. */
export type BallotView = {
  slug: string;
  kind: BallotKind;
  title: string;
  summary: string;
  businessName: string;
  endsAt: string;
  question: string;
  helper: string;
  options: BallotOption[];
  /** The participant's own vote, once cast. */
  vote: { optionIndex: number; castAt: string } | null;
  /** The standings, when the campaign lets this participant see them; otherwise null. */
  results: Results | null;
};

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

/** How a campaign stands, for the business that runs it. */
export type CampaignResults = {
  campaignId: string;
  kind: BallotKind;
  title: string;
  question: string;
  options: Array<BallotOption & { votes: number; percent: number }>;
  total: number;
};

/** The signed-in participant. */
export type Participant = { userId: string; accountType: string };

/** The signed-in person acting on a business, resolved by the session, never by the request. */
export type Actor = { userId: string; tenantId: string; role: string };

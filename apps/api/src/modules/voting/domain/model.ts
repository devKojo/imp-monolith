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

/** One question of a ballot: a poll question with its answers, or the whole list of an image vote's candidates. */
export type BallotQuestion = {
  /** The campaign field that is the question; for an image vote there is just the one, named `candidates`. */
  id: string;
  /** The question's text; empty for an image vote (the campaign's own title asks it). */
  question: string;
  helper: string;
  options: BallotOption[];
};

/**
 * What the options are, built from the campaign's fields. A poll has one or more questions; an image vote
 * has one (its candidates). `question`, `helper` and `options` repeat the first question, for readers that
 * only know the single-question shape.
 */
export type Ballot = {
  kind: BallotKind;
  question: string;
  helper: string;
  options: BallotOption[];
  questions: BallotQuestion[];
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

/**
 * A vote as stored: one row per participant. For an image vote the field is the candidate chosen. For a poll
 * `answers` has the answer to each question by the question's field id; `fieldId` / `choiceIndex` repeat the
 * first one (and are all there is for a poll cast when it had a single question).
 */
export type StoredVote = {
  fieldId: string;
  choiceIndex: number | null;
  answers: Record<string, number>;
  castAt: Date;
};

/** What a cast vote writes. */
export type VoteTarget = {
  fieldId: string;
  choiceIndex: number | null;
  answers: Record<string, number>;
};

/** Votes counted per stored target. */
export type TallyRow = { fieldId: string; choiceIndex: number | null; votes: number };

export type OptionResult = { index: number; votes: number; percent: number };
export type Results = { total: number; options: OptionResult[] };

/** One question as the participant app renders it. */
export type QuestionView = BallotQuestion & {
  /** The answer the participant gave, once they have voted; null otherwise. */
  choice: number | null;
  /** The standings of this question, when the campaign lets this participant see them; otherwise null. */
  results: Results | null;
};

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
  /** The participant's own vote on the first question, once cast. */
  vote: { optionIndex: number; castAt: string } | null;
  /** The standings of the first question, when the campaign lets this participant see them; otherwise null. */
  results: Results | null;
  /** Every question, with the participant's answer and the standings of each. A poll may have several. */
  questions: QuestionView[];
  /** When the participant voted; null before. */
  castAt: string | null;
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
  /** How many questions the ballot asks: one for an image vote. */
  questionCount: number;
};

/** How a campaign stands, for the business that runs it. */
export type CampaignResults = {
  campaignId: string;
  kind: BallotKind;
  title: string;
  question: string;
  options: Array<BallotOption & { votes: number; percent: number }>;
  total: number;
  /** Every question's standings; `question`, `options` and `total` above are the first one's. */
  questions: Array<{
    id: string;
    question: string;
    options: Array<BallotOption & { votes: number; percent: number }>;
    total: number;
  }>;
};

/** The signed-in participant. */
export type Participant = { userId: string; accountType: string };

/** The signed-in person acting on a business, resolved by the session, never by the request. */
export type Actor = { userId: string; tenantId: string; role: string };

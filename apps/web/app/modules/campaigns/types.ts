/**
 * Campaigns as the API returns them (apps/api modules/campaigns). Hand-written until the client is
 * generated (R-STK-04).
 */
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type Archetype = 'giveaway' | 'quiz' | 'survey' | 'instant' | 'poll' | 'vote';

export type FieldKind =
  | 'full_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'wallet'
  | 'choice'
  | 'likert'
  | 'upload'
  | 'text'
  | 'long_text'
  | 'consent'
  | 'quiz_question'
  | 'candidate';

/** `details` are what a participant is asked about themselves; `content` is what the campaign is about. */
export type FieldGroup = 'details' | 'content';

/** One field kind a template allows. */
export type AllowedField = {
  kind: FieldKind;
  group: FieldGroup;
  /** Most a campaign may have of this kind; null means no limit. */
  maxCount: number | null;
  /** How many a new campaign of this type starts with. */
  defaultCount: number;
  defaultLabel: string;
  defaultRequired: boolean;
};

/** A built-in campaign type: global and read-only, it says what a campaign of that type may contain. */
export type TemplateRef = {
  id: string;
  slug: string;
  name: string;
  archetype: Archetype;
  description: string;
  /** A campaign needs at least this many content fields (questions) to launch. */
  minContentFields: number;
  /** A campaign of this type must say what is being given away. */
  requiresPrizes: boolean;
  fields: AllowedField[];
};

export type Prize = {
  /** Server id once saved; a client id while editing. Never sent back. */
  id: string;
  name: string;
  /** Free text shown as written; the platform does not handle money. */
  valueLabel: string;
  winners: number;
  description: string;
  /** What the prize is worth to the winner; absent reads as an item shown as text. */
  kind?: PrizeKind;
  /** Whole minor units (cash) or points; null for an item. */
  amountMinor?: number | null;
  currency?: string | null;
  /** The places this prize covers ("1st" is 1 to 1); both or neither. */
  rankFrom?: number | null;
  rankTo?: number | null;
  /** How winners are chosen: null settles at the end; COMPLETION gives each tier to the next to qualify. */
  selection?: 'RANKING' | 'DRAW' | 'COMPLETION' | null;
};

export type PrizeKind = 'ITEM' | 'CASH' | 'POINTS';

/** A field of a campaign. The id is the server's once saved and a client id while editing; never sent back. */
export type CampaignField = {
  id: string;
  kind: FieldKind;
  /** Machine name, made by the server. */
  key: string;
  label: string;
  helper: string;
  required: boolean;
  /** Answers of a choice or quiz question; empty for other kinds. */
  options: string[];
  /** Index of the correct answer of a quiz question; null until one is marked. */
  correctIndex: number | null;
  /** A candidate's picture in an image vote (an https link); empty for every other kind. */
  imageUrl?: string;
};

export type QuizSettings = {
  /** Minutes for the whole attempt; null for no limit. */
  timeLimitMinutes: number | null;
  passPercent: number;
  /** Attempts a participant may make (1 to 5); one means no retake. */
  maxAttempts: number;
};
/** When people may see how a poll or image vote stands: only once they have voted, or as it runs. */
export type ResultsVisibility = 'after_vote' | 'live';
export type BallotSettings = { showResults: ResultsVisibility };
export type PoolKind = 'POINTS' | 'MONEY';
/** One amount shared equally by a limited number of participants, instead of prize tiers. */
export type PrizePool = {
  kind: PoolKind;
  /** Points, or for money the amount in minor units (500000 is 5,000.00). */
  amount: number;
  /** ISO 4217 code for money; null for points. */
  currency: string | null;
  maxParticipants: number;
};
/** The pool as the API returns it: what was set, and each participant's equal share worked out. */
export type PoolView = PrizePool & {
  share: number;
  remainder: number;
  label: string;
  shareLabel: string;
};
/** What the campaign type uses: `quiz` is only present for a quiz; `pool` for a prize pool campaign. */
export type CampaignSettings = {
  quiz?: QuizSettings;
  /** Only present for a poll or an image vote. */
  ballot?: BallotSettings;
  pool?: PrizePool;
};

export type Campaign = {
  id: string;
  title: string;
  summary: string;
  slug: string | null;
  status: CampaignStatus;
  templateId: string | null;
  template: TemplateRef | null;
  startAt: string | null;
  endAt: string | null;
  prizes: Prize[];
  fields: CampaignField[];
  settings: CampaignSettings;
  /** Bumped by the server on every change; sent back with an action so a stale one is refused. */
  version: number;
  updatedAt: string;
  launchedAt: string | null;
  /** When it was archived; null if it is not. Archived campaigns are left out of the default list. */
  archivedAt: string | null;
  /** Participants admitted so far; a prize pool campaign closes when it reaches the pool's limit. */
  participantCount: number;
  /** The pool with each share worked out, or null when the campaign has prize tiers. */
  pool: PoolView | null;
};

/** One row of the campaign library. */
export type CampaignSummary = Omit<
  Campaign,
  'summary' | 'prizes' | 'fields' | 'settings' | 'launchedAt' | 'pool'
> & {
  prizeCount: number;
  maxParticipants: number | null;
};

export type PreflightId = 'title' | 'template' | 'schedule' | 'prizes' | 'details' | 'content';
export type PreflightCheck = { id: PreflightId; pass: boolean };

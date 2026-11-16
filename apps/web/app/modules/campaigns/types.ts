/**
 * Campaigns as the API returns them (apps/api modules/campaigns). Hand-written until the client is
 * generated (R-STK-04).
 */
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type Archetype = 'giveaway' | 'quiz' | 'survey' | 'instant';

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
  | 'quiz_question';

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
};

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
};

export type QuizSettings = {
  /** Minutes for the whole attempt; null for no limit. */
  timeLimitMinutes: number | null;
  passPercent: number;
};
/** What the campaign type uses: `quiz` is only present for a quiz. */
export type CampaignSettings = { quiz?: QuizSettings };

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
};

/** One row of the campaign library. */
export type CampaignSummary = Omit<
  Campaign,
  'summary' | 'prizes' | 'fields' | 'settings' | 'launchedAt'
> & {
  prizeCount: number;
};

export type PreflightId = 'title' | 'template' | 'schedule' | 'prizes' | 'details' | 'content';
export type PreflightCheck = { id: PreflightId; pass: boolean };

import type { CampaignField, CampaignSettings, FieldGroup, FieldKind } from './fields';
import type { PoolView } from './pool';

/**
 * Campaigns: what a business runs from a built-in campaign type (its template). The page text, the
 * prize tiers, the schedule, the fields (participant details and questions) and the settings live here;
 * the template only says which kinds of field a campaign of that type may use.
 */
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export const LIMITS = {
  titleMax: 120,
  summaryMax: 600,
  prizesMax: 10,
  prizeNameMax: 120,
  valueMax: 60,
  descriptionMax: 300,
  winnersMax: 100_000,
} as const;

/** What the client sends for one prize tier; `id` is assigned by the server. */
export type PrizeInput = {
  name: string;
  /** Free text shown as written (for example "GH₵ 5,000"); the platform does not handle money. */
  valueLabel: string;
  winners: number;
  description: string;
};
export type Prize = PrizeInput & { id: string };

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

/** The built-in campaign type a campaign uses, with what it allows. */
export type TemplateRef = {
  id: string;
  slug: string;
  name: string;
  archetype: 'giveaway' | 'quiz' | 'survey' | 'instant';
  description: string;
  /** A campaign needs at least this many content fields (questions) to launch. */
  minContentFields: number;
  /** A campaign of this type must say what is being given away. */
  requiresPrizes: boolean;
  fields: AllowedField[];
};

/** A campaign as stored: `status` is what was last written, before the schedule is applied. */
export type StoredCampaign = {
  id: string;
  title: string;
  summary: string;
  slug: string | null;
  status: CampaignStatus;
  templateId: string | null;
  startAt: string | null;
  endAt: string | null;
  prizes: Prize[];
  fields: CampaignField[];
  settings: CampaignSettings;
  version: number;
  updatedAt: string;
  launchedAt: string | null;
  /** When it was archived; null if it is not. Archived campaigns are hidden from the default list. */
  archivedAt: string | null;
  /** Participants admitted so far; a prize pool campaign closes when it reaches the pool's limit. */
  participantCount: number;
};
export type StoredSummary = Omit<
  StoredCampaign,
  'summary' | 'prizes' | 'fields' | 'settings' | 'launchedAt'
> & {
  prizeCount: number;
  /** The pool's participant limit, or null for a campaign without a prize pool. */
  maxParticipants: number | null;
};

/** What the API returns: the effective status, and the template it uses. */
export type CampaignDetail = StoredCampaign & {
  template: TemplateRef | null;
  /** The prize pool with each participant's equal share worked out, or null when it has prize tiers. */
  pool: PoolView | null;
};
export type CampaignSummary = StoredSummary & { template: TemplateRef | null };

export type PreflightId = 'title' | 'template' | 'schedule' | 'prizes' | 'details' | 'content';
export type PreflightCheck = { id: PreflightId; pass: boolean };

/** The signed-in person acting on a business, resolved by the session, never by the request. */
export type Actor = { userId: string; tenantId: string; role: string };

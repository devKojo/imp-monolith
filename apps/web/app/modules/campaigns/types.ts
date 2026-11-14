/**
 * Campaigns as the API returns them (apps/api modules/campaigns). Hand-written until the client is
 * generated (R-STK-04).
 */
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type Archetype = 'giveaway' | 'quiz' | 'survey' | 'instant';

/** The template a campaign uses (never its fields; fetch those from the templates API). */
export type TemplateRef = {
  id: string;
  name: string;
  archetype: Archetype;
  status: 'DRAFT' | 'PUBLISHED';
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
  /** Bumped by the server on every change; sent back with an action so a stale one is refused. */
  version: number;
  updatedAt: string;
  launchedAt: string | null;
};

/** One row of the campaign library. */
export type CampaignSummary = Omit<Campaign, 'summary' | 'prizes' | 'launchedAt'> & {
  prizeCount: number;
};

export type PreflightId = 'title' | 'template' | 'schedule' | 'prizes';
export type PreflightCheck = { id: PreflightId; pass: boolean };

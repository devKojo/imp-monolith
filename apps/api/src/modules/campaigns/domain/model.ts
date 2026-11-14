/**
 * Campaigns: what a business runs from a published template. The page text, the prize tiers and the
 * schedule live here; the entry form comes from the template.
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

/** The template a campaign uses, as seen from the campaigns module (never its fields). */
export type TemplateRef = {
  id: string;
  name: string;
  archetype: 'giveaway' | 'quiz' | 'survey' | 'instant';
  status: 'DRAFT' | 'PUBLISHED';
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
  version: number;
  updatedAt: string;
  launchedAt: string | null;
};
export type StoredSummary = Omit<StoredCampaign, 'summary' | 'prizes' | 'launchedAt'> & {
  prizeCount: number;
};

/** What the API returns: the effective status, and the template it uses. */
export type CampaignDetail = StoredCampaign & { template: TemplateRef | null };
export type CampaignSummary = StoredSummary & { template: TemplateRef | null };

export type PreflightId = 'title' | 'template' | 'schedule' | 'prizes';
export type PreflightCheck = { id: PreflightId; pass: boolean };

/** The signed-in person acting on a business, resolved by the session, never by the request. */
export type Actor = { userId: string; tenantId: string; role: string };

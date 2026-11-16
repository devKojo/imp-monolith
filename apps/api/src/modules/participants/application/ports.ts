import type { TenantContext } from '@/shared/database';
import type {
  BusinessActivity,
  CampaignActivity,
  ListQuery,
  ParticipantSummary,
  ParticipationPage,
} from '../domain/model';

/** Read-only storage for what a business sees about its participants. Every call is one business scope. */
export interface ParticipantsRepository {
  summary(ctx: TenantContext): Promise<ParticipantSummary>;
  /** Activity across the whole business over the last days, ending at `today` (a UTC date). */
  activity(ctx: TenantContext, today: Date): Promise<BusinessActivity>;
  /** Activity of one campaign of the business, or null when it has none by that id. `today` is a UTC date. */
  campaign(ctx: TenantContext, campaignId: string, today: Date): Promise<CampaignActivity | null>;
  /** Participation, newest first. */
  list(ctx: TenantContext, query: ListQuery): Promise<ParticipationPage>;
}

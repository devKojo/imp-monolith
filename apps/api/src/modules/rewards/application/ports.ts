import type { TenantContext } from '@/shared/database';
import type {
  AwardRow,
  DrawRecord,
  DrawRow,
  Entrant,
  PlannedAward,
  PublishedDraw,
  SettleableCampaign,
} from '../domain/model';

export type EntrantPurpose = 'ranking' | 'draw' | 'pool';

/** Storage for awards and draws. Every call is one business scope, except `publicDraw`. */
export interface RewardsRepository {
  campaign(ctx: TenantContext, campaignId: string): Promise<SettleableCampaign | null>;
  /** Who is eligible: ranked by best finished attempt, drawn from those who finished, or everyone in. */
  entrants(
    ctx: TenantContext,
    campaign: SettleableCampaign,
    purpose: EntrantPurpose,
  ): Promise<Entrant[]>;
  draw(ctx: TenantContext, campaignId: string): Promise<DrawRow | null>;
  /** Stores the sealed draw, or returns the one that already exists (never two). */
  seal(
    ctx: TenantContext,
    input: { campaignId: string; rulesHash: string; nonce: string; sealedAt: Date },
  ): Promise<DrawRow>;
  /**
   * Writes every award and its first event in one transaction, completing the draw if there is one.
   * Throws AlreadyAwardedError when this campaign already has awards (the unique indexes decide, so two
   * racing settlements cannot both succeed).
   */
  settle(
    ctx: TenantContext,
    input: {
      campaignId: string;
      awards: PlannedAward[];
      claimBy: Date;
      actorId: string | undefined;
      draw: { id: string; record: DrawRecord } | null;
    },
  ): Promise<void>;
  awards(ctx: TenantContext, campaignId: string): Promise<AwardRow[]>;
  /** A made draw by its id, for anyone to verify. Null until the draw has been made. */
  publicDraw(drawId: string): Promise<PublishedDraw | null>;
}

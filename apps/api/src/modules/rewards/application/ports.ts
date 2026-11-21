import type { TenantContext } from '@/shared/database';
import type { SettleFacts } from '../domain/risk';
import type {
  AwardRow,
  DrawRecord,
  DrawRow,
  Entrant,
  FulfilOutcome,
  PayoutRecord,
  ReviewDecision,
  ReviewOutcome,
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
  /** What the winners' join signals, accounts and history say, for the risk rules. Keyed by user id. */
  settlementFacts(
    ctx: TenantContext,
    campaignId: string,
    userIds: readonly string[],
    now: Date,
  ): Promise<Map<string, SettleFacts>>;
  /**
   * Releases or rejects an award that is waiting for review or held. One locked read decides, so two
   * reviewers cannot both act. A release of an award at or above the flag line is refused (`platform`).
   */
  review(
    ctx: TenantContext,
    input: {
      awardId: string;
      actorId: string;
      decision: ReviewDecision;
      reason: string | null;
      now: Date;
      claimBy: Date;
    },
  ): Promise<ReviewOutcome>;
  /**
   * A claimed award's destination, still encrypted. Writes a `destination_viewed` event in the same
   * transaction, so no one can read where money goes without it being recorded. Null when there is nothing
   * to send (no such award, or no destination).
   */
  reveal(ctx: TenantContext, awardId: string, actorId: string): Promise<PayoutRecord | null>;
  /**
   * Marks a claimed cash or item award paid with the business's own reference. One conditional UPDATE
   * decides, so two people paying at once record one payment.
   */
  fulfil(
    ctx: TenantContext,
    input: { awardId: string; actorId: string; reference: string; now: Date },
  ): Promise<FulfilOutcome>;
  /** A made draw by its id, for anyone to verify. Null until the draw has been made. */
  publicDraw(drawId: string): Promise<PublishedDraw | null>;
}

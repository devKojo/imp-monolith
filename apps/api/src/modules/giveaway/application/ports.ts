import type { TenantContext } from '@/shared/database';
import type { EntryRow, RunnableGiveaway } from '../domain/model';

/**
 * Storage for giveaway entries. The participant side finds the campaign by its public address, then works
 * in that campaign's business scope, which the server decides (never the request) and which only ever
 * reaches this participant's own entry.
 */
export interface GiveawayRepository {
  /** A running giveaway by its public address, or null. */
  locate(slug: string, now: Date): Promise<RunnableGiveaway | null>;
  entry(ctx: TenantContext, campaignId: string, userId: string): Promise<EntryRow | null>;
  /** How many people have entered. */
  count(ctx: TenantContext, campaignId: string): Promise<number>;
  /**
   * Enters the participant and takes a seat on the campaign, together, or returns the entry that already
   * exists (never two).
   */
  enter(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; at: Date },
  ): Promise<EntryRow>;
}

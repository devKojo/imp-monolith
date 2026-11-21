import type { TenantContext } from '@/shared/database';
import type {
  BallotField,
  BallotKind,
  RunnableBallot,
  StoredVote,
  TallyRow,
  VoteTarget,
} from '../domain/model';

/**
 * Storage for votes. The participant side finds the campaign by its public address, then works in that
 * campaign's business scope, which the server decides (never the request) and which only ever reaches this
 * participant's own vote. The business side is scoped to the signed-in business.
 */
export interface VotingRepository {
  /** The poll's question or the candidates, in order. */
  fields(ctx: TenantContext, campaignId: string): Promise<BallotField[]>;

  /** A running poll or image vote by its public address, or null. */
  locate(slug: string, now: Date): Promise<RunnableBallot | null>;
  /** The kind and title of one of this business's poll or image vote campaigns, or null. */
  find(ctx: TenantContext, campaignId: string): Promise<{ kind: BallotKind; title: string } | null>;

  vote(ctx: TenantContext, campaignId: string, userId: string): Promise<StoredVote | null>;
  /**
   * Casts the vote and takes a seat on the campaign, together. Returns null when the participant had
   * already voted (nothing is changed).
   */
  cast(
    ctx: TenantContext,
    input: { campaignId: string; userId: string; at: Date } & VoteTarget,
  ): Promise<StoredVote | null>;
  tally(ctx: TenantContext, campaignId: string): Promise<TallyRow[]>;
}

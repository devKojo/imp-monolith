import { randomUUID } from 'node:crypto';
import { canReadCampaigns } from '@/modules/campaigns';
import { createTenantContext, type TenantContext } from '@/shared/database';
import {
  AlreadyVotedError,
  BallotEmptyError,
  BallotNotFoundError,
  InvalidOptionError,
  NoActiveBusinessError,
  ParticipantOnlyError,
  ResultsPermissionError,
} from '../domain/errors';
import type {
  Actor,
  BallotInfo,
  BallotView,
  CampaignResults,
  Participant,
  RunnableBallot,
  StoredVote,
} from '../domain/model';
import { buildBallot, optionIndexOf, targetOf, toResults } from '../domain/rules';
import type { VotingRepository } from './ports';

/**
 * Voting workflows. A participant reads the options, casts one vote and, when the campaign allows, sees how
 * it stands. The business is found from the campaign's public address, never from the request. A business
 * reads the standings of its own campaigns.
 */
export class VotingService {
  constructor(
    private readonly repo: VotingRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async locate(slug: string): Promise<RunnableBallot> {
    const found = await this.repo.locate(slug, this.now());
    if (!found) throw new BallotNotFoundError();
    return found;
  }

  private scopeOf(tenantId: string, actorId?: string): TenantContext {
    return createTenantContext({
      tenantId,
      ...(actorId ? { actorId } : {}),
      requestId: randomUUID(),
    });
  }

  private async enter(participant: Participant | null, slug: string) {
    if (participant?.accountType !== 'PARTICIPANT') throw new ParticipantOnlyError();
    const found = await this.locate(slug);
    const ctx = this.scopeOf(found.tenantId, participant.userId);
    const fields = await this.repo.fields(ctx, found.campaignId);
    const ballot = buildBallot(found.kind, fields);
    if (ballot.options.length === 0) throw new BallotEmptyError();
    return { found, ctx, fields, ballot, userId: participant.userId };
  }

  /** Public facts about a running poll or image vote. Never the standings. */
  async info(slug: string): Promise<BallotInfo> {
    const found = await this.locate(slug);
    const fields = await this.repo.fields(this.scopeOf(found.tenantId), found.campaignId);
    const ballot = buildBallot(found.kind, fields);
    return {
      slug,
      kind: found.kind,
      title: found.title,
      businessName: found.businessName,
      endsAt: found.endAt.toISOString(),
      question: ballot.question,
      optionCount: ballot.options.length,
    };
  }

  private async view(
    ctx: ReturnType<VotingService['scopeOf']>,
    slug: string,
    context: Awaited<ReturnType<VotingService['enter']>>,
    stored: StoredVote | null,
  ): Promise<BallotView> {
    const { found, fields, ballot } = context;
    const index = stored ? optionIndexOf(found.kind, fields, stored) : null;
    // The standings: always for a "live" campaign, otherwise only to someone who has voted.
    const showResults = found.showResults === 'live' || stored !== null;
    const results = showResults
      ? toResults(
          found.kind,
          fields,
          ballot.options.length,
          await this.repo.tally(ctx, found.campaignId),
        )
      : null;
    return {
      slug,
      kind: found.kind,
      title: found.title,
      summary: found.summary,
      businessName: found.businessName,
      endsAt: found.endAt.toISOString(),
      question: ballot.question,
      helper: ballot.helper,
      options: ballot.options,
      vote:
        stored && index !== null
          ? { optionIndex: index, castAt: stored.castAt.toISOString() }
          : null,
      results,
    };
  }

  /** The options, the participant's own vote and, when allowed, the standings. */
  async current(participant: Participant | null, slug: string): Promise<BallotView> {
    const context = await this.enter(participant, slug);
    const stored = await this.repo.vote(context.ctx, context.found.campaignId, context.userId);
    return this.view(context.ctx, slug, context, stored);
  }

  /** Casts the participant's one vote. A second attempt is refused, never replaced. */
  async cast(
    participant: Participant | null,
    slug: string,
    optionIndex: number,
  ): Promise<BallotView> {
    const context = await this.enter(participant, slug);
    const { found, ctx, fields, userId } = context;
    const existing = await this.repo.vote(ctx, found.campaignId, userId);
    if (existing) throw new AlreadyVotedError();

    const target = targetOf(found.kind, fields, optionIndex);
    if (!target) throw new InvalidOptionError();
    const stored = await this.repo.cast(ctx, {
      campaignId: found.campaignId,
      userId,
      ...target,
      at: this.now(),
    });
    // Another tab got there first.
    if (!stored) throw new AlreadyVotedError();
    return this.view(ctx, slug, context, stored);
  }

  /** How one of the business's own polls or image votes stands. */
  async results(actor: Actor | null, campaignId: string): Promise<CampaignResults> {
    if (!actor) throw new NoActiveBusinessError();
    if (!canReadCampaigns(actor.role)) throw new ResultsPermissionError();
    const ctx = this.scopeOf(actor.tenantId, actor.userId);
    const campaign = await this.repo.find(ctx, campaignId);
    if (!campaign) throw new BallotNotFoundError();
    const fields = await this.repo.fields(ctx, campaignId);
    const ballot = buildBallot(campaign.kind, fields);
    const results = toResults(
      campaign.kind,
      fields,
      ballot.options.length,
      await this.repo.tally(ctx, campaignId),
    );
    return {
      campaignId,
      kind: campaign.kind,
      title: campaign.title,
      question: ballot.question,
      total: results.total,
      options: ballot.options.map((o) => ({
        ...o,
        votes: results.options[o.index]!.votes,
        percent: results.options[o.index]!.percent,
      })),
    };
  }
}

import { randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import { newNonce, rulesHashOf, rulesOf, runDraw } from '../domain/draw';
import {
  AlreadyAwardedError,
  CampaignNotEndedError,
  CampaignNotFoundError,
  DrawNotFoundError,
  DrawNotSealedError,
  NoActiveBusinessError,
  NoEntrantsError,
  RewardsPermissionError,
  SealNotAllowedError,
  UnsupportedRewardsError,
} from '../domain/errors';
import type {
  Actor,
  AwardResult,
  AwardRow,
  DrawRecord,
  DrawRow,
  DrawView,
  PlannedAward,
  PublishedDraw,
  SettleableCampaign,
} from '../domain/model';
import { canManageRewards } from '../domain/permissions';
import { drawPlan, poolPlan, rankingPlan, selectionOf } from '../domain/plan';
import type { RewardsRepository } from './ports';

/** How long a winner has to claim before the award expires. */
export const CLAIM_WINDOW_DAYS = 14;

const REASON: Record<'UNSUPPORTED' | 'MIXED' | 'NO_PRIZES', string> = {
  UNSUPPORTED: 'This kind of reward cannot be settled in one step',
  MIXED: 'The prizes of this campaign use different ways of choosing winners',
  NO_PRIZES: 'This campaign has no prizes to award',
};

const view = (d: DrawRow): DrawView => ({
  id: d.id,
  rulesHash: d.rulesHash,
  sealedAt: d.sealedAt.toISOString(),
  drawnAt: d.drawnAt?.toISOString() ?? null,
});

/**
 * Settling a campaign: who won, and what each is owed. The business is resolved from the actor and the role
 * is checked once here, so no route can forget it (R-ARC-08). Winners are never typed in: they come from the
 * score ranking, a pool's equal shares, or a sealed, reproducible draw.
 */
export class RewardsService {
  constructor(
    private readonly repo: RewardsRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private scope(actor: Actor | null): TenantContext {
    if (!actor) throw new NoActiveBusinessError();
    if (!canManageRewards(actor.role)) throw new RewardsPermissionError();
    return createTenantContext({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      requestId: randomUUID(),
    });
  }

  private async load(ctx: TenantContext, campaignId: string): Promise<SettleableCampaign> {
    const c = await this.repo.campaign(ctx, campaignId);
    if (!c) throw new CampaignNotFoundError();
    return c;
  }

  private ended(c: SettleableCampaign): boolean {
    if (c.status === 'DRAFT' || c.status === 'CANCELLED') return false;
    // COMPLETED with the end date still ahead means a prize pool campaign that is full.
    return c.status === 'COMPLETED' || (c.endAt !== null && c.endAt <= this.now());
  }

  /**
   * Fixes the draw's rules and randomness before the campaign closes. Publishes only a commitment; safe to
   * repeat (it returns the same sealed draw).
   */
  async seal(actor: Actor | null, campaignId: string): Promise<DrawView> {
    const ctx = this.scope(actor);
    const c = await this.load(ctx, campaignId);
    const picked = selectionOf(c);
    if (!picked.ok) throw new UnsupportedRewardsError(REASON[picked.reason]);
    if (picked.selection !== 'DRAW') throw new SealNotAllowedError('Only a draw needs sealing');
    if (c.status === 'DRAFT' || c.status === 'CANCELLED' || this.ended(c)) {
      throw new SealNotAllowedError('Seal a draw while its campaign is open');
    }
    const nonce = newNonce();
    const sealed = await this.repo.seal(ctx, {
      campaignId,
      rulesHash: rulesHashOf(rulesOf(c), nonce),
      nonce,
      sealedAt: this.now(),
    });
    return view(sealed);
  }

  /** Settles an ended campaign once: creates every award, claimable for `CLAIM_WINDOW_DAYS`. */
  async award(actor: Actor | null, campaignId: string): Promise<AwardResult> {
    const ctx = this.scope(actor);
    const c = await this.load(ctx, campaignId);
    if (!this.ended(c)) throw new CampaignNotEndedError();
    const picked = selectionOf(c);
    if (!picked.ok) throw new UnsupportedRewardsError(REASON[picked.reason]);

    let awards: PlannedAward[];
    let draw: { id: string; record: DrawRecord } | null = null;
    let drawn: DrawRow | null = null;

    if (picked.selection === 'RANKING') {
      awards = rankingPlan(c.prizes, await this.repo.entrants(ctx, c, 'ranking'));
    } else if (picked.selection === 'POOL' && c.pool) {
      awards = poolPlan(
        c.pool,
        (await this.repo.entrants(ctx, c, 'pool')).map((e) => e.userId),
      );
    } else {
      const sealed = await this.repo.draw(ctx, campaignId);
      // The seal must predate the close and still match the prizes, or the draw is not the one promised.
      if (!sealed || (c.endAt && sealed.sealedAt > c.endAt)) throw new DrawNotSealedError();
      if (sealed.drawnAt) throw new AlreadyAwardedError();
      if (rulesHashOf(rulesOf(c), sealed.nonce) !== sealed.rulesHash)
        throw new DrawNotSealedError();
      const entrants = await this.repo.entrants(ctx, c, 'draw');
      const outcome = runDraw({
        drawId: sealed.id,
        rulesHash: sealed.rulesHash,
        nonce: sealed.nonce,
        userIds: entrants.map((e) => e.userId),
      });
      awards = drawPlan(c.prizes, outcome.order);
      draw = {
        id: sealed.id,
        record: {
          rules: rulesOf(c),
          entrantsHash: outcome.entrantsHash,
          entrants: outcome.refs,
          seed: outcome.seed,
          winners: awards.map((a, i) => ({
            ref: outcome.orderRefs[i] as string,
            prizeId: a.prizeId as string,
            slot: a.slot,
          })),
          drawnAt: this.now(),
        },
      };
      drawn = { ...sealed, drawnAt: draw.record.drawnAt };
    }

    if (awards.length === 0) throw new NoEntrantsError();
    const now = this.now();
    await this.repo.settle(ctx, {
      campaignId,
      awards,
      claimBy: new Date(now.getTime() + CLAIM_WINDOW_DAYS * 86_400_000),
      actorId: ctx.actorId,
      draw,
    });
    return {
      campaignId,
      selection: picked.selection,
      awarded: awards.length,
      draw: drawn ? view(drawn) : null,
    };
  }

  async awards(actor: Actor | null, campaignId: string): Promise<AwardRow[]> {
    const ctx = this.scope(actor);
    await this.load(ctx, campaignId);
    return this.repo.awards(ctx, campaignId);
  }

  /** Anyone can fetch a made draw and re-run it. */
  async publicDraw(drawId: string): Promise<PublishedDraw> {
    const found = await this.repo.publicDraw(drawId);
    if (!found) throw new DrawNotFoundError();
    return found;
  }
}

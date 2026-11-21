import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { poolOf } from '@/modules/campaigns';
import { ConflictError } from '@/shared/errors';
import { withPublic, withTenant, type TenantContext, type TenantTx } from '@/shared/database';
import type { EntrantPurpose, RewardsRepository } from '../application/ports';
import { AlreadyAwardedError } from '../domain/errors';
import { businessMayRelease, type SettleFacts } from '../domain/risk';
import { settlementFactsIn } from './settlement-facts';
import type {
  AwardRow,
  DrawRecord,
  DrawRow,
  Entrant,
  FulfilOutcome,
  PayoutRecord,
  PlannedAward,
  ReviewDecision,
  ReviewOutcome,
  PublishedDraw,
  SettleableCampaign,
} from '../domain/model';

/** `withTenant` turns a unique violation (P2002) into a ConflictError; accept either form. */
const isUniqueViolation = (e: unknown): boolean =>
  e instanceof ConflictError ||
  (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002');

const num = (v: bigint | null): number | null => (v === null ? null : Number(v));

/** The distinct rule codes recorded on an award's events (`metadata.risk.rules`), in the order first seen. */
const ruleCodes = (metadata: unknown[]): string[] => {
  const codes = new Set<string>();
  for (const m of metadata) {
    const rules = (m as { risk?: { rules?: Array<{ code?: unknown }> } } | null)?.risk?.rules;
    for (const rule of rules ?? []) if (typeof rule.code === 'string') codes.add(rule.code);
  }
  return [...codes];
};

/** The payment reference a business recorded, from the event's metadata. */
const referenceOf = (metadata: unknown): string | null => {
  const ref = (metadata as { reference?: unknown } | null | undefined)?.reference;
  return typeof ref === 'string' ? ref : null;
};

/** What a made draw keeps in `winners`: the rules, the entrant references and the winners, all public. */
type StoredDraw = Pick<PublishedDraw, 'rules' | 'entrants' | 'winners'>;

/**
 * Awards and draws in PostgreSQL. Every call is one `withTenant` transaction (row-level security applies)
 * except `publicDraw`, which reads only draws that have been made, through `withPublic`.
 */
export class PrismaRewardsRepository implements RewardsRepository {
  constructor(private readonly db: PrismaClient) {}

  campaign(ctx: TenantContext, campaignId: string): Promise<SettleableCampaign | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const c = await tx.campaign.findFirst({
        where: { id: campaignId, tenantId: ctx.tenantId, deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          endAt: true,
          settings: true,
          template: { select: { archetype: true } },
          prizes: { orderBy: { position: 'asc' } },
        },
      });
      if (!c?.template) return null;
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        endAt: c.endAt,
        archetype: c.template.archetype,
        pool: poolOf(c.settings),
        prizes: c.prizes.map((p) => ({
          id: p.id,
          position: p.position,
          name: p.name,
          kind: p.kind,
          amountMinor: num(p.amountMinor),
          currency: p.currency,
          winners: p.winners,
          rankFrom: p.rankFrom,
          rankTo: p.rankTo,
          selection: p.selection,
        })),
      };
    });
  }

  entrants(
    ctx: TenantContext,
    campaign: SettleableCampaign,
    purpose: EntrantPurpose,
  ): Promise<Entrant[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const where = { tenantId: ctx.tenantId, campaignId: campaign.id };
      switch (campaign.archetype) {
        case 'QUIZ': {
          // A pool shares among everyone who started; otherwise only a finished, not-failed attempt counts.
          const rows = await tx.quizAttempt.findMany({
            where:
              purpose === 'pool'
                ? where
                : { ...where, submittedAt: { not: null }, NOT: { passed: false } },
            select: { userId: true, score: true, submittedAt: true, startedAt: true },
          });
          const best = new Map<string, Entrant>();
          for (const r of rows) {
            const e = { userId: r.userId, score: r.score, at: r.submittedAt ?? r.startedAt };
            const cur = best.get(r.userId);
            if (
              !cur ||
              (e.score ?? 0) > (cur.score ?? 0) ||
              ((e.score ?? 0) === (cur.score ?? 0) && e.at < cur.at)
            ) {
              best.set(r.userId, e);
            }
          }
          return [...best.values()];
        }
        case 'SURVEY': {
          const rows = await tx.surveyResponse.findMany({
            where: purpose === 'pool' ? where : { ...where, submittedAt: { not: null } },
            select: { userId: true, submittedAt: true, startedAt: true },
          });
          return rows.map((r) => ({
            userId: r.userId,
            score: null,
            at: r.submittedAt ?? r.startedAt,
          }));
        }
        case 'POLL':
        case 'VOTE': {
          const rows = await tx.vote.findMany({ where, select: { userId: true, castAt: true } });
          return rows.map((r) => ({ userId: r.userId, score: null, at: r.castAt }));
        }
        case 'GIVEAWAY': {
          const rows = await tx.giveawayEntry.findMany({
            where,
            select: { userId: true, enteredAt: true },
          });
          return rows.map((r) => ({ userId: r.userId, score: null, at: r.enteredAt }));
        }
        default:
          return [];
      }
    });
  }

  private toDraw(r: {
    id: string;
    rulesHash: string;
    entropy: string | null;
    sealedAt: Date;
    drawnAt: Date | null;
  }): DrawRow {
    return {
      id: r.id,
      rulesHash: r.rulesHash,
      nonce: r.entropy ?? '',
      sealedAt: r.sealedAt,
      drawnAt: r.drawnAt,
    };
  }

  draw(ctx: TenantContext, campaignId: string): Promise<DrawRow | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const r = await tx.rewardDraw.findFirst({ where: { tenantId: ctx.tenantId, campaignId } });
      return r ? this.toDraw(r) : null;
    });
  }

  async seal(
    ctx: TenantContext,
    input: { campaignId: string; rulesHash: string; nonce: string; sealedAt: Date },
  ): Promise<DrawRow> {
    try {
      return await withTenant(this.db, ctx, async (tx) =>
        this.toDraw(
          await tx.rewardDraw.create({
            data: {
              tenantId: ctx.tenantId,
              campaignId: input.campaignId,
              rulesHash: input.rulesHash,
              entropy: input.nonce,
              sealedAt: input.sealedAt,
            },
          }),
        ),
      );
    } catch (e) {
      // Sealed already (a double click, a second tab): the first seal stands.
      if (!isUniqueViolation(e)) throw e;
      const existing = await this.draw(ctx, input.campaignId);
      if (existing) return existing;
      throw e;
    }
  }

  async settle(
    ctx: TenantContext,
    input: {
      campaignId: string;
      awards: PlannedAward[];
      claimBy: Date;
      actorId: string | undefined;
      draw: { id: string; record: DrawRecord } | null;
    },
  ): Promise<void> {
    try {
      await withTenant(this.db, ctx, async (tx: TenantTx) => {
        if (input.draw) {
          const { id, record } = input.draw;
          const stored: StoredDraw = {
            rules: record.rules,
            entrants: record.entrants,
            winners: record.winners,
          };
          // Completes the draw only if it has not been made yet: a second settlement finds nothing to update.
          const done = await tx.rewardDraw.updateMany({
            where: { id, tenantId: ctx.tenantId, drawnAt: null },
            data: {
              entrantsHash: record.entrantsHash,
              entrantCount: record.entrants.length,
              seed: record.seed,
              winners: stored as unknown as Prisma.InputJsonValue,
              drawnAt: record.drawnAt,
            },
          });
          if (done.count === 0) throw new AlreadyAwardedError();
        }
        // What the risk rules found decides whether an award can be claimed now or waits for review.
        const waits = (a: PlannedAward) => a.risk !== undefined && a.risk.band !== 'ALLOW';
        const created = await tx.rewardAward.createManyAndReturn({
          data: input.awards.map((a) => ({
            tenantId: ctx.tenantId,
            campaignId: input.campaignId,
            prizeId: a.prizeId,
            userId: a.userId,
            slot: a.slot,
            rank: a.rank,
            kind: a.kind,
            amountMinor: a.amountMinor,
            currency: a.currency,
            source: a.source,
            status: waits(a) ? ('PENDING_REVIEW' as const) : ('AVAILABLE' as const),
            // The claim clock starts when the award is released, not while it waits.
            claimBy: waits(a) ? null : input.claimBy,
            riskScore: a.risk?.score ?? 0,
          })),
          select: { id: true, userId: true, source: true, rank: true, slot: true, status: true },
        });
        const riskOf = new Map(input.awards.map((a) => [a.userId, a.risk]));
        await tx.rewardEvent.createMany({
          data: created.map((a) => {
            const risk = riskOf.get(a.userId);
            return {
              tenantId: ctx.tenantId,
              awardId: a.id,
              actorId: input.actorId ?? null,
              type: 'awarded',
              toStatus: a.status,
              // A generic reason: winners see this, never which rule fired.
              ...(a.status === 'PENDING_REVIEW' ? { reasonCode: 'REVIEW_REQUIRED' } : {}),
              metadata: {
                source: a.source,
                slot: a.slot,
                ...(a.rank ? { rank: a.rank } : {}),
                ...(risk && risk.reasons.length > 0
                  ? { risk: { score: risk.score, version: risk.version, rules: risk.reasons } }
                  : {}),
              } as Prisma.InputJsonObject,
            };
          }),
        });
      });
    } catch (e) {
      // A second settlement collides with the unique slot / person indexes: one settlement only.
      if (isUniqueViolation(e)) throw new AlreadyAwardedError();
      throw e;
    }
  }

  awards(ctx: TenantContext, campaignId: string): Promise<AwardRow[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.rewardAward.findMany({
        where: { tenantId: ctx.tenantId, campaignId },
        include: {
          user: { select: { name: true } },
          claim: { select: { method: true, destinationHint: true } },
          events: {
            where: { type: { in: ['fulfilled', 'awarded', 'held'] } },
            select: { type: true, metadata: true },
          },
        },
        orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.user.name,
        prizeId: r.prizeId,
        slot: r.slot,
        rank: r.rank,
        kind: r.kind,
        amountMinor: num(r.amountMinor),
        currency: r.currency,
        source: r.source,
        status: r.status,
        claimBy: r.claimBy?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        payoutMethod: r.claim?.method ?? null,
        payoutHint: r.claim?.destinationHint ?? null,
        paidReference: referenceOf(r.events.find((e) => e.type === 'fulfilled')?.metadata),
        riskScore: r.riskScore,
        riskReasons: ruleCodes(r.events.map((e) => e.metadata)),
      }));
    });
  }

  settlementFacts(
    ctx: TenantContext,
    campaignId: string,
    userIds: readonly string[],
    now: Date,
  ): Promise<Map<string, SettleFacts>> {
    return withTenant(this.db, ctx, (tx) =>
      settlementFactsIn(tx, { tenantId: ctx.tenantId, campaignId, userIds, now }),
    );
  }

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
  ): Promise<ReviewOutcome> {
    const { awardId, actorId, decision, reason, now, claimBy } = input;
    return withTenant(this.db, ctx, async (tx): Promise<ReviewOutcome> => {
      // The row lock makes two reviewers act one after the other, never both.
      const rows = await tx.$queryRaw<Array<{ status: string; risk_score: number }>>`
        SELECT status::text AS status, risk_score FROM reward_awards
        WHERE id = ${awardId}::uuid AND tenant_id = ${ctx.tenantId}::uuid FOR UPDATE`;
      const r = rows[0];
      if (!r) return { kind: 'missing' };
      // Release and reject are for awards waiting for review. A recall (revoke) also covers one that is
      // available or claimed but not yet paid; a paid or ended award cannot be recalled.
      const reviewable = r.status === 'PENDING_REVIEW' || r.status === 'HELD';
      const recallable = reviewable || r.status === 'AVAILABLE' || r.status === 'CLAIMED';
      if (decision === 'revoke' ? !recallable : !reviewable) {
        return { kind: 'blocked', status: r.status };
      }
      if (decision === 'release' && !businessMayRelease(r.risk_score)) return { kind: 'platform' };

      const to =
        decision === 'revoke'
          ? 'REVOKED'
          : decision === 'reject'
            ? 'REJECTED'
            : r.status === 'PENDING_REVIEW'
              ? 'AVAILABLE'
              : 'CLAIMED';
      if (to === 'AVAILABLE') {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'AVAILABLE'::"AwardStatus", claim_by = ${claimBy}, updated_at = ${now}
          WHERE id = ${awardId}::uuid AND tenant_id = ${ctx.tenantId}::uuid`;
      } else if (to === 'CLAIMED') {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'CLAIMED'::"AwardStatus", updated_at = ${now}
          WHERE id = ${awardId}::uuid AND tenant_id = ${ctx.tenantId}::uuid`;
      } else if (to === 'REJECTED') {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'REJECTED'::"AwardStatus", updated_at = ${now}
          WHERE id = ${awardId}::uuid AND tenant_id = ${ctx.tenantId}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'REVOKED'::"AwardStatus", updated_at = ${now}
          WHERE id = ${awardId}::uuid AND tenant_id = ${ctx.tenantId}::uuid`;
      }
      await tx.rewardEvent.create({
        data: {
          tenantId: ctx.tenantId,
          awardId,
          actorId,
          type:
            decision === 'release' ? 'released' : decision === 'reject' ? 'rejected' : 'revoked',
          fromStatus: r.status as 'PENDING_REVIEW' | 'HELD' | 'AVAILABLE' | 'CLAIMED',
          toStatus: to,
          reasonCode: reason ?? (decision === 'release' ? 'REVIEWED_OK' : null),
        },
      });
      return { kind: 'done', status: to };
    });
  }

  reveal(ctx: TenantContext, awardId: string, actorId: string): Promise<PayoutRecord | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const r = await tx.rewardAward.findFirst({
        where: { id: awardId, tenantId: ctx.tenantId },
        include: { user: { select: { name: true } }, claim: true },
      });
      if (!r?.claim) return null;
      await tx.rewardEvent.create({
        data: {
          tenantId: ctx.tenantId,
          awardId,
          actorId,
          type: 'destination_viewed',
          fromStatus: r.status,
          toStatus: r.status,
        },
      });
      return {
        awardId,
        winnerName: r.user.name,
        kind: r.kind,
        amountMinor: num(r.amountMinor),
        currency: r.currency,
        method: r.claim.method,
        accountName: r.claim.accountName,
        encrypted: r.claim.destinationEnc,
      };
    });
  }

  fulfil(
    ctx: TenantContext,
    input: { awardId: string; actorId: string; reference: string; now: Date },
  ): Promise<FulfilOutcome> {
    return withTenant(this.db, ctx, async (tx): Promise<FulfilOutcome> => {
      const { awardId, actorId, reference, now } = input;
      const moved = await tx.$queryRaw<Array<{ id: string }>>`UPDATE reward_awards
        SET status = 'FULFILLED'::"AwardStatus", updated_at = ${now}
        WHERE id = ${awardId}::uuid AND tenant_id = ${ctx.tenantId}::uuid
          AND status = 'CLAIMED' AND kind <> 'POINTS'
        RETURNING id`;
      if (moved.length === 0) {
        const r = await tx.rewardAward.findFirst({
          where: { id: awardId, tenantId: ctx.tenantId },
          include: {
            events: { where: { type: 'fulfilled' }, select: { metadata: true }, take: 1 },
          },
        });
        if (!r) return { kind: 'missing' };
        if (r.status === 'FULFILLED') {
          return { kind: 'already', reference: referenceOf(r.events[0]?.metadata) };
        }
        return { kind: 'blocked', status: r.status };
      }
      await tx.rewardEvent.create({
        data: {
          tenantId: ctx.tenantId,
          awardId,
          actorId,
          type: 'fulfilled',
          fromStatus: 'CLAIMED',
          toStatus: 'FULFILLED',
          metadata: { reference },
        },
      });
      return { kind: 'fulfilled' };
    });
  }

  publicDraw(drawId: string): Promise<PublishedDraw | null> {
    return withPublic(this.db, async (tx) => {
      const r = await tx.rewardDraw.findFirst({ where: { id: drawId, drawnAt: { not: null } } });
      if (!r?.drawnAt || !r.entropy || !r.seed || !r.entrantsHash) return null;
      const stored = r.winners as unknown as StoredDraw;
      return {
        drawId: r.id,
        rules: stored.rules,
        nonce: r.entropy,
        rulesHash: r.rulesHash,
        entrants: stored.entrants,
        entrantsHash: r.entrantsHash,
        seed: r.seed,
        winners: stored.winners,
        sealedAt: r.sealedAt.toISOString(),
        drawnAt: r.drawnAt.toISOString(),
      };
    });
  }
}

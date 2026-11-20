import type { PrismaClient } from '@/generated/prisma/client';
import {
  recordSignal,
  withParticipant,
  withTenant,
  type TenantContext,
  type TenantTx,
} from '@/shared/database';
import { ConflictError } from '@/shared/errors';
import type { MyRewardsRepository } from '../application/my-ports';
import { creditsAtClaim, effectiveState, needsDestination, type AwardState } from '../domain/claim';
import type {
  ClaimDestination,
  ClaimOutcome,
  ClaimTarget,
  MyAward,
  MyAwardDetail,
  MyAwardsPage,
  PrizeKind,
  WalletBalance,
  Selection,
} from '../domain/model';
import { NO_CLAIM_FACTS, assessClaim, type ClaimFacts } from '../domain/risk';
import { appendPoints } from './points-ledger';

const num = (v: bigint | null): number | null => (v === null ? null : Number(v));

type AwardWithContext = {
  id: string;
  status: AwardState;
  kind: PrizeKind;
  amountMinor: bigint | null;
  currency: string | null;
  source: Selection;
  rank: number | null;
  claimBy: Date | null;
  createdAt: Date;
  campaign: { id: string; title: string; slug: string | null; business: { name: string } };
  prize: { name: string } | null;
  claim: { destinationHint: string } | null;
};

const INCLUDE = {
  campaign: { select: { id: true, title: true, slug: true, business: { select: { name: true } } } },
  prize: { select: { name: true } },
  claim: { select: { destinationHint: true } },
} as const;

const toAward = (r: AwardWithContext, now: Date): MyAward => ({
  id: r.id,
  status: effectiveState(r.status, r.claimBy, now),
  kind: r.kind,
  amountMinor: num(r.amountMinor),
  currency: r.currency,
  source: r.source,
  rank: r.rank,
  prizeName: r.prize?.name ?? null,
  claimBy: r.claimBy?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  campaign: { id: r.campaign.id, title: r.campaign.title, slug: r.campaign.slug },
  businessName: r.campaign.business.name,
  needsDestination: needsDestination(r.kind),
  claimHint: r.claim?.destinationHint ?? null,
});

type ClaimInput = {
  awardId: string;
  userId: string;
  now: Date;
  destination: ClaimDestination | null;
};

/**
 * A participant's own awards. Reads run in the participant scope (their own rows only); the claim runs in
 * the award's business scope, always filtered to the signed-in person's own award.
 */
export class PrismaMyRewardsRepository implements MyRewardsRepository {
  constructor(private readonly db: PrismaClient) {}

  list(userId: string, page: { limit: number; offset: number }, now: Date): Promise<MyAwardsPage> {
    return withParticipant(this.db, userId, async (tx) => {
      const where = { userId };
      const [rows, total] = await Promise.all([
        tx.rewardAward.findMany({
          where,
          include: INCLUDE,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: page.limit,
          skip: page.offset,
        }),
        tx.rewardAward.count({ where }),
      ]);
      return { items: rows.map((r) => toAward(r, now)), total };
    });
  }

  get(userId: string, awardId: string, now: Date): Promise<MyAwardDetail | null> {
    return withParticipant(this.db, userId, async (tx) => {
      const r = await tx.rewardAward.findFirst({
        where: { id: awardId, userId },
        include: { ...INCLUDE, events: { orderBy: { createdAt: 'asc' } } },
      });
      if (!r) return null;
      return {
        ...toAward(r, now),
        events: r.events.map((e) => ({
          type: e.type,
          toStatus: e.toStatus,
          reasonCode: e.reasonCode,
          at: e.createdAt.toISOString(),
        })),
      };
    });
  }

  wallet(userId: string): Promise<WalletBalance[]> {
    return withParticipant(this.db, userId, async (tx) => {
      const sums = await tx.pointsLedger.groupBy({
        by: ['tenantId'],
        where: { userId },
        _sum: { delta: true },
      });
      const held = sums.filter((s) => Number(s._sum.delta ?? 0) > 0);
      const names = await tx.business.findMany({
        where: { id: { in: held.map((s) => s.tenantId) } },
        select: { id: true, name: true },
      });
      const nameOf = new Map(names.map((b) => [b.id, b.name]));
      return held
        .map((s) => ({ businessName: nameOf.get(s.tenantId) ?? '', points: Number(s._sum.delta) }))
        .sort((a, b) => b.points - a.points);
    });
  }

  locate(userId: string, awardId: string): Promise<ClaimTarget | null> {
    return withParticipant(this.db, userId, async (tx) => {
      const r = await tx.rewardAward.findFirst({
        where: { id: awardId, userId },
        select: {
          tenantId: true,
          campaignId: true,
          kind: true,
          amountMinor: true,
          status: true,
          claimBy: true,
        },
      });
      return r ? { ...r, amountMinor: num(r.amountMinor) } : null;
    });
  }

  async claim(ctx: TenantContext, input: ClaimInput): Promise<ClaimOutcome> {
    try {
      return await withTenant(this.db, ctx, (tx) => this.claimIn(tx, ctx.tenantId, input));
    } catch (e) {
      // A double click or a second tab claimed at the same moment: show what that claim did.
      if (!(e instanceof ConflictError)) throw e;
      return withTenant(this.db, ctx, (tx) => this.existing(tx, ctx.tenantId, input));
    }
  }

  private async existing(tx: TenantTx, tenantId: string, input: ClaimInput): Promise<ClaimOutcome> {
    const r = await tx.rewardAward.findFirst({
      where: { id: input.awardId, tenantId, userId: input.userId },
      include: { claim: { select: { destinationHint: true } } },
    });
    if (!r) return { kind: 'missing' };
    return { kind: 'already', status: r.status, hint: r.claim?.destinationHint ?? null };
  }

  /** The facts the claim rules need, read in the claim's own transaction. Counts of other people only. */
  private async claimFacts(
    tx: TenantTx,
    q: { tenantId: string; campaignId: string; userId: string; fingerprint: string; now: Date },
  ): Promise<ClaimFacts> {
    const { tenantId, campaignId, userId } = q;
    const since = new Date(q.now.getTime() - 86_400_000);
    const sameDestination = await tx.rewardClaim.findMany({
      where: { tenantId, destinationHash: q.fingerprint, userId: { not: userId } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const joined = await tx.participationSignal.findFirst({
      where: { tenantId, campaignId, userId, kind: 'JOIN', ipHash: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { ipHash: true },
    });
    // The signal just recorded for this claim.
    const claiming = await tx.participationSignal.findFirst({
      where: { tenantId, userId, kind: 'CLAIM' },
      orderBy: { createdAt: 'desc' },
      select: { ipHash: true },
    });
    const network = claiming?.ipHash ?? null;
    const others = network
      ? await tx.participationSignal.findMany({
          where: {
            tenantId,
            kind: 'CLAIM',
            ipHash: network,
            userId: { not: userId },
            createdAt: { gte: since },
          },
          distinct: ['userId'],
          select: { userId: true },
        })
      : [];
    const claimsToday = await tx.participationSignal.count({
      where: { tenantId, userId, kind: 'CLAIM', createdAt: { gte: since } },
    });
    return {
      ...NO_CLAIM_FACTS,
      destinationUsers: sameDestination.length,
      claimNetworkUsers: others.length,
      // The claim being made has already left its own signal.
      recentClaims: Math.max(0, claimsToday - 1),
      networkChanged: !!(joined?.ipHash && network && joined.ipHash !== network),
    };
  }

  async report(
    ctx: TenantContext,
    input: {
      awardId: string;
      campaignId: string;
      userId: string;
      reason: string;
      details: string;
      severity: number;
    },
  ): Promise<void> {
    await withTenant(this.db, ctx, async (tx) => {
      // createMany does not read the row back: the business scope may insert reports but never read them.
      await tx.scamReport.createMany({
        data: [
          {
            tenantId: ctx.tenantId,
            campaignId: input.campaignId,
            awardId: input.awardId,
            userId: input.userId,
            reason: input.reason as
              'ASKED_TO_PAY' | 'SUSPICIOUS_CONTACT' | 'NOT_RECEIVED' | 'OTHER',
            details: input.details,
            severity: input.severity,
          },
        ],
        skipDuplicates: true,
      });
    });
  }

  private async claimIn(tx: TenantTx, tenantId: string, input: ClaimInput): Promise<ClaimOutcome> {
    const { awardId, userId, now, destination } = input;
    // One conditional UPDATE decides: only an available award inside its window moves, so two racing
    // claims cannot both succeed and an expired award cannot be claimed.
    const moved = await tx.$queryRaw<
      Array<{ kind: PrizeKind; amount_minor: bigint | null; campaign_id: string }>
    >`UPDATE reward_awards SET status = 'CLAIMED'::"AwardStatus", updated_at = ${now}
      WHERE id = ${awardId}::uuid AND tenant_id = ${tenantId}::uuid AND user_id = ${userId}::uuid
        AND status = 'AVAILABLE' AND claim_by > ${now}
      RETURNING kind, amount_minor, campaign_id`;

    const award = moved[0];
    if (!award) {
      const r = await tx.rewardAward.findFirst({
        where: { id: awardId, tenantId, userId },
        include: { claim: { select: { destinationHint: true } } },
      });
      if (!r) return { kind: 'missing' };
      // A claimed award the risk rules then held is still claimed: repeating the claim is not an error.
      if (r.status === 'CLAIMED' || r.status === 'FULFILLED' || (r.status === 'HELD' && r.claim)) {
        return { kind: 'already', status: r.status, hint: r.claim?.destinationHint ?? null };
      }
      if (r.status === 'EXPIRED') return { kind: 'expired' };
      if (r.status === 'AVAILABLE') {
        // Past its deadline: write that down, so the timeline says what happened.
        await tx.$executeRaw`UPDATE reward_awards SET status = 'EXPIRED'::"AwardStatus", updated_at = ${now}
          WHERE id = ${awardId}::uuid AND tenant_id = ${tenantId}::uuid AND status = 'AVAILABLE'`;
        await tx.rewardEvent.create({
          data: {
            tenantId,
            awardId,
            type: 'expired',
            fromStatus: 'AVAILABLE',
            toStatus: 'EXPIRED',
            reasonCode: 'CLAIM_WINDOW_ENDED',
          },
        });
        return { kind: 'expired' };
      }
      return { kind: 'blocked', status: r.status };
    }

    const amount = num(award.amount_minor);
    await recordSignal(tx, { tenantId, campaignId: award.campaign_id, userId, kind: 'CLAIM' });
    // Money and items are checked against what else is known (who else used this destination, from where).
    const claimRisk = destination
      ? assessClaim(
          await this.claimFacts(tx, {
            tenantId,
            campaignId: award.campaign_id,
            userId,
            fingerprint: destination.fingerprint,
            now,
          }),
        )
      : null;
    await tx.rewardEvent.create({
      data: {
        tenantId,
        awardId,
        actorId: userId,
        type: 'claimed',
        fromStatus: 'AVAILABLE',
        toStatus: 'CLAIMED',
        metadata: destination ? { method: destination.method } : {},
      },
    });

    if (destination) {
      await tx.rewardClaim.create({
        data: {
          tenantId,
          awardId,
          userId,
          method: destination.method as 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'DELIVERY',
          accountName: destination.accountName,
          destinationEnc: destination.encrypted,
          destinationHash: destination.fingerprint,
          destinationHint: destination.hint,
        },
      });
    }

    if (claimRisk && claimRisk.score > 0) {
      const held = claimRisk.band !== 'ALLOW';
      await tx.$executeRaw`UPDATE reward_awards
        SET risk_score = LEAST(100, risk_score + ${claimRisk.score}),
            status = CASE WHEN ${held} THEN 'HELD'::"AwardStatus" ELSE status END,
            updated_at = ${now}
        WHERE id = ${awardId}::uuid AND tenant_id = ${tenantId}::uuid AND status = 'CLAIMED'`;
      if (held) {
        await tx.rewardEvent.create({
          data: {
            tenantId,
            awardId,
            type: 'held',
            fromStatus: 'CLAIMED',
            toStatus: 'HELD',
            // A generic reason: the winner sees this, never which rule fired.
            reasonCode: 'REVIEW_REQUIRED',
            metadata: {
              stage: 'claim',
              risk: {
                score: claimRisk.score,
                version: claimRisk.version,
                rules: claimRisk.reasons,
              },
            },
          },
        });
        return { kind: 'claimed', status: 'HELD', hint: destination?.hint ?? null };
      }
    }

    if (amount !== null && creditsAtClaim(award.kind, amount)) {
      // The ledger key makes this a no-op if it ever ran twice for the same award.
      await appendPoints(tx, {
        tenantId,
        userId,
        awardId,
        delta: amount,
        reason: 'reward',
        idempotencyKey: `award:${awardId}`,
      });
      await tx.$executeRaw`UPDATE reward_awards SET status = 'FULFILLED'::"AwardStatus", updated_at = ${now}
        WHERE id = ${awardId}::uuid AND tenant_id = ${tenantId}::uuid AND status = 'CLAIMED'`;
      await tx.rewardEvent.create({
        data: {
          tenantId,
          awardId,
          type: 'fulfilled',
          fromStatus: 'CLAIMED',
          toStatus: 'FULFILLED',
          reasonCode: 'POINTS_CREDITED',
        },
      });
      return { kind: 'claimed', status: 'FULFILLED', hint: null };
    }
    return { kind: 'claimed', status: 'CLAIMED', hint: destination?.hint ?? null };
  }
}

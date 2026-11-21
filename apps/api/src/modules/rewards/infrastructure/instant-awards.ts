import type { Prisma } from '@/generated/prisma/client';
import type { TenantTx } from '@/shared/database';
import { expandSlots } from '../domain/plan';
import type { PrizeRow } from '../domain/model';
import { NO_SETTLE_FACTS, assessSettlement } from '../domain/risk';
import { settlementFactsIn } from './settlement-facts';

/** How long a winner has to claim before the award expires. */
const CLAIM_WINDOW_DAYS = 14;

export type InstantAward = {
  awardId: string;
  /** `PENDING_REVIEW` when the risk rules held it for the business to look at. */
  status: 'AVAILABLE' | 'PENDING_REVIEW';
  rank: number | null;
};

/**
 * Awards the next free tier to someone the moment they qualify (they pass a quiz, or finish a survey), for a
 * campaign whose prizes are given first come, first served. It runs in the caller's transaction, so the award
 * exists exactly when the pass does. The campaign row is locked while it decides, so two people who pass at the
 * same moment take two different tiers and nobody takes the same one; a person is awarded once; when every tier
 * is taken, later people simply get nothing. The risk rules score the winner as they do at settlement: what they
 * cannot clear waits for the business to review. Returns null when there was nothing to award.
 */
export async function allocateOnCompletion(
  tx: TenantTx,
  input: {
    tenantId: string;
    campaignId: string;
    userId: string;
    /** The kind of campaign the person has just qualified in. */
    archetype: 'QUIZ' | 'SURVEY';
    now: Date;
  },
): Promise<InstantAward | null> {
  const { tenantId, campaignId, userId, now } = input;

  // One decision at a time per campaign.
  const locked = await tx.$queryRaw<Array<{ archetype: string | null }>>`
    SELECT t.archetype::text AS archetype
    FROM campaigns c LEFT JOIN campaign_templates t ON t.id = c.template_id
    WHERE c.id = ${campaignId}::uuid AND c.tenant_id = ${tenantId}::uuid AND c.deleted_at IS NULL
    FOR UPDATE OF c`;
  if (locked[0]?.archetype !== input.archetype) return null;

  const prizes = await tx.campaignPrize.findMany({
    where: { tenantId, campaignId },
    orderBy: { position: 'asc' },
  });
  // Only when every prize is given as people qualify (a campaign settled at the end is not touched).
  if (prizes.length === 0 || !prizes.every((p) => p.selection === 'COMPLETION')) return null;

  const existing = await tx.rewardAward.findMany({
    where: { tenantId, campaignId },
    select: { userId: true, prizeId: true, slot: true },
  });
  if (existing.some((a) => a.userId === userId)) return null;

  const rows: PrizeRow[] = prizes.map((p) => ({
    id: p.id,
    position: p.position,
    name: p.name,
    kind: p.kind,
    amountMinor: p.amountMinor === null ? null : Number(p.amountMinor),
    currency: p.currency,
    winners: p.winners,
    rankFrom: p.rankFrom,
    rankTo: p.rankTo,
    selection: p.selection,
  }));
  const taken = new Set(existing.map((a) => `${a.prizeId}:${a.slot}`));
  const slot = expandSlots(rows).find((s) => !taken.has(`${s.prize.id}:${s.slot}`));
  if (!slot) return null;

  // The same rules as at settlement, seen from this winner among the people already awarded.
  const facts = await settlementFactsIn(tx, {
    tenantId,
    campaignId,
    userIds: [...new Set([...existing.map((a) => a.userId), userId])],
    now,
  });
  const risk = assessSettlement(facts.get(userId) ?? NO_SETTLE_FACTS);
  const waits = risk.band !== 'ALLOW';

  const award = await tx.rewardAward.create({
    data: {
      tenantId,
      campaignId,
      prizeId: slot.prize.id,
      userId,
      slot: slot.slot,
      rank: slot.rank,
      kind: slot.prize.kind,
      amountMinor: slot.prize.amountMinor,
      currency: slot.prize.currency,
      source: 'COMPLETION',
      status: waits ? 'PENDING_REVIEW' : 'AVAILABLE',
      // The claim clock starts when the award is released, not while it waits.
      claimBy: waits ? null : new Date(now.getTime() + CLAIM_WINDOW_DAYS * 86_400_000),
      riskScore: risk.score,
    },
    select: { id: true },
  });
  await tx.rewardEvent.create({
    data: {
      tenantId,
      awardId: award.id,
      actorId: null,
      type: 'awarded',
      toStatus: waits ? 'PENDING_REVIEW' : 'AVAILABLE',
      // A generic reason: winners see this, never which rule fired.
      ...(waits ? { reasonCode: 'REVIEW_REQUIRED' } : {}),
      metadata: {
        source: 'COMPLETION',
        slot: slot.slot,
        rank: slot.rank,
        ...(risk.reasons.length > 0
          ? { risk: { score: risk.score, version: risk.version, rules: risk.reasons } }
          : {}),
      } as Prisma.InputJsonObject,
    },
  });
  return {
    awardId: award.id,
    status: waits ? 'PENDING_REVIEW' : 'AVAILABLE',
    rank: slot.rank,
  };
}

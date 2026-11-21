import type { TenantTx } from '@/shared/database';
import { settleFactsFrom } from '../domain/facts';
import type { SettleFacts } from '../domain/risk';

/**
 * What the winners' join signals, accounts and history say, read in the caller's transaction (tenant scope).
 * Counts of other people only. Shared by settling a finished campaign and by awarding someone the moment they
 * qualify, so the same rules see the same facts either way.
 */
export async function settlementFactsIn(
  tx: TenantTx,
  q: { tenantId: string; campaignId: string; userIds: readonly string[]; now: Date },
): Promise<Map<string, SettleFacts>> {
  const { tenantId, campaignId } = q;
  const ids = [...q.userIds];
  const own = await tx.participationSignal.findMany({
    where: { tenantId, campaignId, kind: 'JOIN', userId: { in: ids } },
    select: { ipHash: true },
  });
  const ips = [...new Set(own.flatMap((s) => (s.ipHash ? [s.ipHash] : [])))];
  // Everyone who joined from a winner's network, capped so one huge shared network cannot stall settling.
  const signals =
    ips.length === 0
      ? []
      : await tx.participationSignal.findMany({
          where: { tenantId, campaignId, kind: 'JOIN', ipHash: { in: ips } },
          select: { userId: true, ipHash: true, uaHash: true },
          take: 20_000,
        });
  const users = await tx.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, createdAt: true },
  });
  const prior = await tx.rewardAward.groupBy({
    by: ['userId'],
    where: { tenantId, userId: { in: ids }, status: { in: ['REJECTED', 'REVOKED'] } },
    _count: { _all: true },
  });
  return settleFactsFrom({
    winners: ids,
    signals,
    createdAt: new Map(users.map((u) => [u.id, u.createdAt])),
    priorRejections: new Map(prior.map((p) => [p.userId, p._count._all])),
    now: q.now,
  });
}

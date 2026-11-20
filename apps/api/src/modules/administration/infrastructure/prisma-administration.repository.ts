import type { PrismaClient } from '@/generated/prisma/client';
import type { AdministrationRepository } from '../application/ports';
import type {
  Decision,
  DecisionOutcome,
  ReportItem,
  ReportPage,
  ReportStatus,
  ResolveOutcome,
  ReviewItem,
  ReviewPage,
} from '../domain/model';
import { scamScore } from '../domain/scam';

const num = (v: bigint | null): number | null => (v === null ? null : Number(v));

/** The distinct rule codes recorded on an award's events (`metadata.risk.rules`). */
const ruleCodes = (metadata: unknown[]): string[] => {
  const codes = new Set<string>();
  for (const m of metadata) {
    const rules = (m as { risk?: { rules?: Array<{ code?: unknown }> } } | null)?.risk?.rules;
    for (const rule of rules ?? []) if (typeof rule.code === 'string') codes.add(rule.code);
  }
  return [...codes];
};

const WAITING = ['PENDING_REVIEW', 'HELD'] as const;
const UNPAID = ['PENDING_REVIEW', 'HELD', 'AVAILABLE', 'CLAIMED'] as const;

/**
 * Platform review on the platform database role (BYPASSRLS), which only this module may use. Everything here
 * reads across businesses, so nothing is filtered by tenant; who may call it is decided one layer up.
 */
export class PrismaAdministrationRepository implements AdministrationRepository {
  constructor(private readonly db: PrismaClient) {}

  async isStaff(userId: string): Promise<boolean> {
    const r = await this.db.platformStaff.findFirst({ where: { userId, revokedAt: null } });
    return r !== null;
  }

  private async businessNames(ids: string[]): Promise<Map<string, string>> {
    const rows = await this.db.business.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((b) => [b.id, b.name]));
  }

  async queue(page: { limit: number; offset: number }): Promise<ReviewPage> {
    const where = { status: { in: [...WAITING] } };
    const [total, rows] = await Promise.all([
      this.db.rewardAward.count({ where }),
      this.db.rewardAward.findMany({
        where,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: page.offset,
        take: page.limit,
        include: {
          user: { select: { name: true } },
          campaign: { select: { title: true } },
          claim: { select: { destinationHash: true } },
          events: { where: { type: { in: ['awarded', 'held'] } }, select: { metadata: true } },
        },
      }),
    ]);
    const names = await this.businessNames([...new Set(rows.map((r) => r.tenantId))]);

    // The same payout destination in other businesses.
    const hashes = rows.flatMap((r) => (r.claim ? [r.claim.destinationHash] : []));
    const byHash =
      hashes.length === 0
        ? []
        : await this.db.rewardClaim.groupBy({
            by: ['destinationHash', 'tenantId'],
            where: { destinationHash: { in: hashes } },
          });
    // Joins from the same network in other businesses.
    const joins = await this.db.participationSignal.findMany({
      where: { kind: 'JOIN', userId: { in: rows.map((r) => r.userId) }, ipHash: { not: null } },
      select: { userId: true, campaignId: true, ipHash: true },
    });
    const ips = [...new Set(joins.flatMap((j) => (j.ipHash ? [j.ipHash] : [])))];
    const sameNetwork =
      ips.length === 0
        ? []
        : await this.db.participationSignal.groupBy({
            by: ['ipHash', 'tenantId'],
            where: { kind: 'JOIN', ipHash: { in: ips } },
          });

    const items = rows.map((r): ReviewItem => {
      const mine = joins
        .filter((j) => j.userId === r.userId && j.campaignId === r.campaignId)
        .flatMap((j) => (j.ipHash ? [j.ipHash] : []));
      const dest = r.claim?.destinationHash;
      return {
        awardId: r.id,
        status: r.status as 'PENDING_REVIEW' | 'HELD',
        riskScore: r.riskScore,
        riskReasons: ruleCodes(r.events.map((e) => e.metadata)),
        crossBusiness: {
          destinationBusinesses: dest
            ? new Set(
                byHash
                  .filter((h) => h.destinationHash === dest && h.tenantId !== r.tenantId)
                  .map((h) => h.tenantId),
              ).size
            : 0,
          networkBusinesses: new Set(
            sameNetwork
              .filter((s) => s.ipHash && mine.includes(s.ipHash) && s.tenantId !== r.tenantId)
              .map((s) => s.tenantId),
          ).size,
        },
        businessName: names.get(r.tenantId) ?? '',
        campaignTitle: r.campaign.title,
        winnerName: r.user.name,
        kind: r.kind,
        amountMinor: num(r.amountMinor),
        currency: r.currency,
        createdAt: r.createdAt.toISOString(),
      };
    });
    return { items, total };
  }

  async reports(input: {
    status: ReportStatus;
    limit: number;
    offset: number;
  }): Promise<ReportPage> {
    const where = { status: input.status };
    const [total, rows] = await Promise.all([
      this.db.scamReport.count({ where }),
      this.db.scamReport.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: input.offset,
        take: input.limit,
        include: {
          user: { select: { name: true } },
          campaign: { select: { title: true } },
        },
      }),
    ]);
    const tenants = [...new Set(rows.map((r) => r.tenantId))];
    const names = await this.businessNames(tenants);
    const open = await this.db.scamReport.findMany({
      where: { tenantId: { in: tenants }, status: 'OPEN' },
      select: { tenantId: true, userId: true, severity: true },
    });
    const items = rows.map((r): ReportItem => {
      const theirs = open.filter((o) => o.tenantId === r.tenantId);
      return {
        id: r.id,
        awardId: r.awardId,
        status: r.status,
        reason: r.reason,
        details: r.details,
        severity: r.severity,
        reporterName: r.user.name,
        businessName: names.get(r.tenantId) ?? '',
        campaignTitle: r.campaign.title,
        createdAt: r.createdAt.toISOString(),
        businessOpenReports: theirs.length,
        businessScamScore: scamScore(
          theirs.map((o) => ({ severity: o.severity, reporterId: o.userId })),
        ),
        resolution: r.resolution,
      };
    });
    return { items, total };
  }

  decide(input: {
    awardId: string;
    actorId: string;
    decision: Decision;
    note: string;
    now: Date;
    claimBy: Date;
  }): Promise<DecisionOutcome> {
    const { awardId, actorId, decision, note, now, claimBy } = input;
    return this.db.$transaction(async (tx): Promise<DecisionOutcome> => {
      // The row lock makes two reviewers act one after the other, never both.
      const rows = await tx.$queryRaw<Array<{ status: string; tenant_id: string }>>`
        SELECT status::text AS status, tenant_id FROM reward_awards WHERE id = ${awardId}::uuid FOR UPDATE`;
      const r = rows[0];
      if (!r) return { kind: 'missing' };
      const allowed: readonly string[] = decision === 'revoke' ? UNPAID : WAITING;
      if (!allowed.includes(r.status)) return { kind: 'blocked', status: r.status };

      const to =
        decision === 'revoke'
          ? 'REVOKED'
          : decision === 'reject'
            ? 'REJECTED'
            : r.status === 'PENDING_REVIEW'
              ? 'AVAILABLE'
              : 'CLAIMED';
      if (to === 'AVAILABLE') {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'AVAILABLE'::"AwardStatus", claim_by = ${claimBy}, updated_at = ${now} WHERE id = ${awardId}::uuid`;
      } else if (to === 'CLAIMED') {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'CLAIMED'::"AwardStatus", updated_at = ${now} WHERE id = ${awardId}::uuid`;
      } else if (to === 'REJECTED') {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'REJECTED'::"AwardStatus", updated_at = ${now} WHERE id = ${awardId}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE reward_awards SET status = 'REVOKED'::"AwardStatus", updated_at = ${now} WHERE id = ${awardId}::uuid`;
      }
      await tx.rewardEvent.create({
        data: {
          tenantId: r.tenant_id,
          awardId,
          actorId,
          type: `platform_${decision}d`,
          fromStatus: r.status as 'PENDING_REVIEW' | 'HELD' | 'AVAILABLE' | 'CLAIMED',
          toStatus: to,
          // Generic for the winner and the business; the reviewer's own note stays in the metadata.
          reasonCode: decision === 'release' ? 'PLATFORM_REVIEWED' : 'PLATFORM_DECISION',
          metadata: { platform: true, ...(note ? { note } : {}) },
        },
      });
      return { kind: 'done', status: to };
    });
  }

  async resolve(input: {
    reportId: string;
    actorId: string;
    status: 'REVIEWED' | 'DISMISSED';
    note: string;
    now: Date;
  }): Promise<ResolveOutcome> {
    // Only an open report can be resolved, and the update itself decides, so two reviewers cannot both.
    const moved = await this.db.scamReport.updateMany({
      where: { id: input.reportId, status: 'OPEN' },
      data: {
        status: input.status,
        resolvedById: input.actorId,
        resolvedAt: input.now,
        resolution: input.note,
      },
    });
    if (moved.count === 1) return { kind: 'done' };
    const r = await this.db.scamReport.findUnique({
      where: { id: input.reportId },
      select: { status: true },
    });
    return r ? { kind: 'already', status: r.status } : { kind: 'missing' };
  }
}

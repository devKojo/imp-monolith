import type { CampaignStatus as DbStatus, Prisma, PrismaClient } from '@/generated/prisma/client';
import { withTenant, writeAudit, type TenantContext, type TenantTx } from '@/shared/database';
import type { CampaignRepository, DraftContent, WriteResult } from '../application/ports';
import type { CampaignStatus, Prize, StoredCampaign, StoredSummary } from '../domain/model';

const withPrizes = {
  prizes: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.CampaignInclude;
type Row = Prisma.CampaignGetPayload<{ include: typeof withPrizes }>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function summaryOf(r: Omit<Row, 'prizes'> & { _count: { prizes: number } }): StoredSummary {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    templateId: r.templateId,
    startAt: iso(r.startAt),
    endAt: iso(r.endAt),
    version: r.version,
    updatedAt: r.updatedAt.toISOString(),
    prizeCount: r._count.prizes,
  };
}

function detailOf(r: Row): StoredCampaign {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    slug: r.slug,
    status: r.status,
    templateId: r.templateId,
    startAt: iso(r.startAt),
    endAt: iso(r.endAt),
    prizes: r.prizes.map((p): Prize => ({
      id: p.id,
      name: p.name,
      valueLabel: p.valueLabel,
      winners: p.winners,
      description: p.description,
    })),
    version: r.version,
    updatedAt: r.updatedAt.toISOString(),
    launchedAt: iso(r.launchedAt),
  };
}

/** Only the prize's own fields: never an id, so a copy of a prize gets a new one. */
const prizeRows = (
  ctx: TenantContext,
  campaignId: string,
  prizes: ReadonlyArray<{ name: string; valueLabel: string; winners: number; description: string }>,
) =>
  prizes.map((p, position) => ({
    tenantId: ctx.tenantId,
    campaignId,
    position,
    name: p.name,
    valueLabel: p.valueLabel,
    winners: p.winners,
    description: p.description,
  }));

/**
 * Campaigns in PostgreSQL. Every call is one `withTenant` transaction, so row-level security applies
 * and an unscoped query sees nothing. Writes that depend on what the caller read put the version and
 * the allowed statuses in the UPDATE's WHERE clause, so the check and the write are one atomic step.
 */
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly db: PrismaClient) {}

  list(ctx: TenantContext): Promise<StoredSummary[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.campaign.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { prizes: true } } },
      });
      return rows.map(summaryOf);
    });
  }

  get(ctx: TenantContext, id: string): Promise<StoredCampaign | null> {
    return withTenant(this.db, ctx, (tx) => this.read(tx, ctx, id));
  }

  private async read(tx: TenantTx, ctx: TenantContext, id: string): Promise<StoredCampaign | null> {
    const row = await tx.campaign.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: withPrizes,
    });
    return row ? detailOf(row) : null;
  }

  create(
    ctx: TenantContext,
    input: { title: string; templateId: string | null; createdById: string },
  ): Promise<StoredCampaign> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.campaign.create({
        data: {
          tenantId: ctx.tenantId,
          title: input.title,
          templateId: input.templateId,
          createdById: input.createdById,
        },
        include: withPrizes,
      });
      await this.audit(tx, ctx, 'campaign.created', row.id);
      return detailOf(row);
    });
  }

  saveDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    content: DraftContent,
  ): Promise<WriteResult> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: this.guard(ctx, id, expectedVersion, ['DRAFT']),
        data: {
          title: content.title,
          summary: content.summary,
          templateId: content.templateId,
          startAt: content.startAt,
          endAt: content.endAt,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return this.whyNotWritten(tx, ctx, id, ['DRAFT']);

      await tx.campaignPrize.deleteMany({ where: { tenantId: ctx.tenantId, campaignId: id } });
      if (content.prizes.length > 0) {
        await tx.campaignPrize.createMany({ data: prizeRows(ctx, id, content.prizes) });
      }
      return this.finish(tx, ctx, id, 'campaign.updated');
    });
  }

  launch(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    input: { status: 'SCHEDULED' | 'LIVE'; slug: string },
  ): Promise<WriteResult> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: this.guard(ctx, id, expectedVersion, ['DRAFT']),
        data: {
          status: input.status,
          slug: input.slug,
          launchedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return this.whyNotWritten(tx, ctx, id, ['DRAFT']);
      return this.finish(tx, ctx, id, 'campaign.launched');
    });
  }

  transition(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    change: { from: CampaignStatus[]; to: CampaignStatus },
  ): Promise<WriteResult> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: this.guard(ctx, id, expectedVersion, change.from),
        data: { status: change.to, version: { increment: 1 } },
      });
      if (updated.count === 0) return this.whyNotWritten(tx, ctx, id, change.from);
      const action = { PAUSED: 'paused', CANCELLED: 'cancelled' }[change.to as string] ?? 'resumed';
      return this.finish(tx, ctx, id, `campaign.${action}`);
    });
  }

  duplicate(
    ctx: TenantContext,
    id: string,
    input: { title: string; createdById: string },
  ): Promise<StoredCampaign | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const source = await tx.campaign.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        include: withPrizes,
      });
      if (!source) return null;
      const copy = await tx.campaign.create({
        data: {
          tenantId: ctx.tenantId,
          title: input.title,
          summary: source.summary,
          templateId: source.templateId,
          createdById: input.createdById,
        },
      });
      if (source.prizes.length > 0) {
        await tx.campaignPrize.createMany({ data: prizeRows(ctx, copy.id, source.prizes) });
      }
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'campaign.duplicated',
        targetType: 'campaign',
        targetId: copy.id,
        metadata: { sourceId: id },
      });
      return this.read(tx, ctx, copy.id);
    });
  }

  softDelete(ctx: TenantContext, id: string): Promise<'ok' | 'not_found' | 'locked'> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: { id, tenantId: ctx.tenantId, deletedAt: null, status: 'DRAFT' },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (updated.count === 0) {
        const current = await tx.campaign.findFirst({
          where: { id, tenantId: ctx.tenantId, deletedAt: null },
          select: { id: true },
        });
        return current ? 'locked' : 'not_found';
      }
      await this.audit(tx, ctx, 'campaign.deleted', id);
      return 'ok';
    });
  }

  private guard(
    ctx: TenantContext,
    id: string,
    version: number,
    statuses: readonly DbStatus[],
  ): Prisma.CampaignWhereInput {
    return {
      id,
      tenantId: ctx.tenantId,
      deletedAt: null,
      version,
      status: { in: [...statuses] },
    };
  }

  /** Why an UPDATE matched nothing: missing, in the wrong state, or someone else changed it first. */
  private async whyNotWritten(
    tx: TenantTx,
    ctx: TenantContext,
    id: string,
    allowed: readonly DbStatus[],
  ): Promise<WriteResult> {
    const current = await tx.campaign.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      select: { status: true },
    });
    if (!current) return { kind: 'not_found' };
    return { kind: allowed.includes(current.status) ? 'conflict' : 'wrong_state' };
  }

  private async finish(
    tx: TenantTx,
    ctx: TenantContext,
    id: string,
    action: string,
  ): Promise<WriteResult> {
    const campaign = await this.read(tx, ctx, id);
    if (!campaign) return { kind: 'not_found' };
    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action,
      targetType: 'campaign',
      targetId: id,
      metadata: { version: campaign.version },
    });
    return { kind: 'ok', campaign };
  }

  private audit(tx: TenantTx, ctx: TenantContext, action: string, id: string) {
    return writeAudit(tx, {
      tenantId: ctx.tenantId,
      actorId: ctx.actorId ?? null,
      action,
      targetType: 'campaign',
      targetId: id,
    });
  }
}

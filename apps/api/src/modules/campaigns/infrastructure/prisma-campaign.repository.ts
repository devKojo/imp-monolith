import type {
  CampaignFieldKind,
  CampaignStatus as DbStatus,
  Prisma,
  PrismaClient,
} from '@/generated/prisma/client';
import { withTenant, writeAudit, type TenantContext, type TenantTx } from '@/shared/database';
import type { CampaignRepository, DraftContent, WriteResult } from '../application/ports';
import type { CampaignField, CampaignSettings, FieldInput, FieldKind } from '../domain/fields';
import type {
  CampaignStatus,
  Prize,
  PrizeInput,
  StoredCampaign,
  StoredSummary,
} from '../domain/model';
import { poolOf } from '../domain/pool';

const withContent = {
  prizes: { orderBy: { position: 'asc' } },
  fields: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.CampaignInclude;
type Row = Prisma.CampaignGetPayload<{ include: typeof withContent }>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function summaryOf(
  r: Omit<Row, 'prizes' | 'fields'> & { _count: { prizes: number } },
): StoredSummary {
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
    archivedAt: iso(r.archivedAt),
    participantCount: r.participantCount,
    maxParticipants: poolOf(r.settings)?.maxParticipants ?? null,
    prizeCount: r._count.prizes,
  };
}

/** The settings column is JSON written by this module; read it defensively anyway. */
function settingsOf(value: unknown): CampaignSettings {
  const quiz = (
    value as {
      quiz?: { timeLimitMinutes?: unknown; passPercent?: unknown; maxAttempts?: unknown };
    } | null
  )?.quiz;
  const pool = poolOf(value);
  const ballot = (value as { ballot?: { showResults?: unknown } } | null)?.ballot;
  return {
    ...(quiz && typeof quiz.passPercent === 'number'
      ? {
          quiz: {
            timeLimitMinutes:
              typeof quiz.timeLimitMinutes === 'number' ? quiz.timeLimitMinutes : null,
            passPercent: quiz.passPercent,
            maxAttempts: typeof quiz.maxAttempts === 'number' ? quiz.maxAttempts : 1,
          },
        }
      : {}),
    ...(ballot
      ? {
          ballot: {
            showResults:
              ballot.showResults === 'live' ? ('live' as const) : ('after_vote' as const),
          },
        }
      : {}),
    ...(pool ? { pool } : {}),
  };
}

const fieldOf = (f: Row['fields'][number]): CampaignField => ({
  id: f.id,
  kind: f.kind.toLowerCase() as FieldKind,
  key: f.key,
  label: f.label,
  helper: f.helper,
  required: f.required,
  options: f.options,
  correctIndex: f.correctIndex,
  imageUrl: f.imageUrl,
});

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
    prizes: r.prizes.map(prizeOf),
    fields: r.fields.map(fieldOf),
    settings: settingsOf(r.settings),
    version: r.version,
    updatedAt: r.updatedAt.toISOString(),
    launchedAt: iso(r.launchedAt),
    archivedAt: iso(r.archivedAt),
    participantCount: r.participantCount,
  };
}

type PrizeRecord = Row['prizes'][number];

const prizeOf = (p: PrizeRecord): Prize => ({
  id: p.id,
  name: p.name,
  valueLabel: p.valueLabel,
  winners: p.winners,
  description: p.description,
  kind: p.kind,
  amountMinor: p.amountMinor === null ? null : Number(p.amountMinor),
  currency: p.currency,
  rankFrom: p.rankFrom,
  rankTo: p.rankTo,
  selection:
    p.selection === 'RANKING' || p.selection === 'DRAW' || p.selection === 'COMPLETION'
      ? p.selection
      : null,
});

/** Only the prize's own fields: never an id, so a copy of a prize gets a new one. */
const prizeRows = (ctx: TenantContext, campaignId: string, prizes: readonly PrizeInput[]) =>
  prizes.map((p, position) => ({
    tenantId: ctx.tenantId,
    campaignId,
    position,
    name: p.name,
    valueLabel: p.valueLabel,
    winners: p.winners,
    description: p.description,
    kind: p.kind ?? 'ITEM',
    amountMinor: p.amountMinor ?? null,
    currency: p.currency ?? null,
    rankFrom: p.rankFrom ?? null,
    rankTo: p.rankTo ?? null,
    selection: p.selection ?? null,
  }));

/** Fields as rows, in the order given. The API's lowercase kind is the enum's uppercase form. */
const fieldRows = (ctx: TenantContext, campaignId: string, fields: readonly FieldInput[]) =>
  fields.map((f, position) => ({
    tenantId: ctx.tenantId,
    campaignId,
    position,
    kind: f.kind.toUpperCase() as CampaignFieldKind,
    key: f.key,
    label: f.label,
    helper: f.helper,
    required: f.required,
    options: f.options,
    correctIndex: f.correctIndex,
    imageUrl: f.imageUrl ?? '',
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
      include: withContent,
    });
    return row ? detailOf(row) : null;
  }

  create(
    ctx: TenantContext,
    input: {
      title: string;
      templateId: string | null;
      createdById: string;
      fields: FieldInput[];
      settings: CampaignSettings;
    },
  ): Promise<StoredCampaign> {
    return withTenant(this.db, ctx, async (tx) => {
      const created = await tx.campaign.create({
        data: {
          tenantId: ctx.tenantId,
          title: input.title,
          templateId: input.templateId,
          createdById: input.createdById,
          settings: input.settings,
        },
      });
      if (input.fields.length > 0) {
        await tx.campaignField.createMany({ data: fieldRows(ctx, created.id, input.fields) });
      }
      const row = await tx.campaign.findUniqueOrThrow({
        where: { id: created.id },
        include: withContent,
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
          settings: content.settings,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return this.whyNotWritten(tx, ctx, id, ['DRAFT']);

      await tx.campaignPrize.deleteMany({ where: { tenantId: ctx.tenantId, campaignId: id } });
      if (content.prizes.length > 0) {
        await tx.campaignPrize.createMany({ data: prizeRows(ctx, id, content.prizes) });
      }
      await tx.campaignField.deleteMany({ where: { tenantId: ctx.tenantId, campaignId: id } });
      if (content.fields.length > 0) {
        await tx.campaignField.createMany({ data: fieldRows(ctx, id, content.fields) });
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
    change: { from: CampaignStatus[]; to: CampaignStatus; endAt?: Date },
  ): Promise<WriteResult> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: this.guard(ctx, id, expectedVersion, change.from),
        data: {
          status: change.to,
          ...(change.endAt ? { endAt: change.endAt } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return this.whyNotWritten(tx, ctx, id, change.from);
      const action = change.from.includes('CANCELLED')
        ? 'republished'
        : ({ PAUSED: 'paused', CANCELLED: 'cancelled', COMPLETED: 'ended' }[change.to as string] ??
          'resumed');
      return this.finish(tx, ctx, id, `campaign.${action}`);
    });
  }

  returnToDraft(ctx: TenantContext, id: string, expectedVersion: number): Promise<WriteResult> {
    const from: DbStatus[] = ['SCHEDULED', 'LIVE', 'PAUSED', 'CANCELLED'];
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: {
          ...this.guard(ctx, id, expectedVersion, from),
          participantCount: 0,
          attempts: { none: {} },
          surveyResponses: { none: {} },
        },
        // The address is released; launching again picks a new one.
        data: { status: 'DRAFT', slug: null, launchedAt: null, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        const why = await this.whyNotWritten(tx, ctx, id, from);
        if (why.kind !== 'conflict') return why;
        const taken = await tx.campaign.findFirst({
          where: {
            id,
            tenantId: ctx.tenantId,
            OR: [
              { participantCount: { gt: 0 } },
              { attempts: { some: {} } },
              { surveyResponses: { some: {} } },
            ],
          },
          select: { id: true },
        });
        return taken ? { kind: 'has_participants' } : why;
      }
      return this.finish(tx, ctx, id, 'campaign.returned_to_draft');
    });
  }

  setArchived(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    archived: boolean,
  ): Promise<WriteResult> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: {
          id,
          tenantId: ctx.tenantId,
          deletedAt: null,
          version: expectedVersion,
          archivedAt: archived ? null : { not: null },
        },
        data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        const current = await tx.campaign.findFirst({
          where: { id, tenantId: ctx.tenantId, deletedAt: null },
          select: { archivedAt: true },
        });
        if (!current) return { kind: 'not_found' };
        // Already what was asked: say so; otherwise someone changed it since the caller read it.
        return { kind: (current.archivedAt !== null) === archived ? 'wrong_state' : 'conflict' };
      }
      return this.finish(tx, ctx, id, archived ? 'campaign.archived' : 'campaign.unarchived');
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
        include: withContent,
      });
      if (!source) return null;
      const copy = await tx.campaign.create({
        data: {
          tenantId: ctx.tenantId,
          title: input.title,
          summary: source.summary,
          templateId: source.templateId,
          createdById: input.createdById,
          settings: settingsOf(source.settings),
        },
      });
      if (source.prizes.length > 0) {
        await tx.campaignPrize.createMany({
          data: prizeRows(ctx, copy.id, source.prizes.map(prizeOf)),
        });
      }
      if (source.fields.length > 0) {
        // A copy gets its own ids; only the content is carried over.
        await tx.campaignField.createMany({
          data: fieldRows(ctx, copy.id, source.fields.map(fieldOf)),
        });
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
      // An archived campaign is put away: it cannot be edited or launched until it is unarchived.
      archivedAt: null,
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
      select: { status: true, archivedAt: true },
    });
    if (!current) return { kind: 'not_found' };
    if (current.archivedAt !== null) return { kind: 'wrong_state' };
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

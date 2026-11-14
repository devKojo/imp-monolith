import type {
  Prisma,
  PrismaClient,
  TemplateArchetype,
  TemplateFieldKind,
  TemplateStatus as DbStatus,
} from '@/generated/prisma/client';
import { withTenant, writeAudit, type TenantContext, type TenantTx } from '@/shared/database';
import type { TemplateRepository, WriteResult } from '../application/ports';
import type {
  Archetype,
  FieldInput,
  FieldKind,
  TemplateDetail,
  TemplateField,
  TemplateStatus,
  TemplateSummary,
} from '../domain/model';

const withFields = {
  fields: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.TemplateInclude;
type Row = Prisma.TemplateGetPayload<{ include: typeof withFields }>;

const toDbArchetype = (a: Archetype) => a.toUpperCase() as TemplateArchetype;
const toDbKind = (k: FieldKind) => k.toUpperCase() as TemplateFieldKind;

function summaryOf(
  row: {
    id: string;
    name: string;
    archetype: TemplateArchetype;
    status: DbStatus;
    version: number;
    updatedAt: Date;
    publishedAt: Date | null;
  },
  fieldCount: number,
): TemplateSummary {
  return {
    id: row.id,
    name: row.name,
    archetype: row.archetype.toLowerCase() as Archetype,
    status: row.status,
    version: row.version,
    fieldCount,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

function detailOf(row: Row): TemplateDetail {
  const { fieldCount: _count, ...summary } = summaryOf(row, row.fields.length);
  return {
    ...summary,
    fields: row.fields.map((f): TemplateField => ({
      id: f.id,
      kind: f.kind.toLowerCase() as FieldKind,
      key: f.key,
      label: f.label,
      helper: f.helper,
      required: f.required,
      options: f.options,
    })),
  };
}

const fieldRows = (ctx: TenantContext, templateId: string, fields: readonly FieldInput[]) =>
  fields.map((f, position) => ({
    tenantId: ctx.tenantId,
    templateId,
    position,
    kind: toDbKind(f.kind),
    key: f.key,
    label: f.label,
    helper: f.helper,
    required: f.required,
    options: f.options,
  }));

/**
 * Templates in PostgreSQL. Every call is one `withTenant` transaction, so row-level security
 * applies and an unscoped query sees nothing. Writes that depend on what the caller read put the
 * version and status in the UPDATE's WHERE clause, so the check and the write are one atomic step.
 */
export class PrismaTemplateRepository implements TemplateRepository {
  constructor(private readonly db: PrismaClient) {}

  list(
    ctx: TenantContext,
    filter: { status?: TemplateStatus; q?: string },
  ): Promise<TemplateSummary[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.template.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { fields: true } } },
      });
      return rows.map((r) => summaryOf(r, r._count.fields));
    });
  }

  get(ctx: TenantContext, id: string): Promise<TemplateDetail | null> {
    return withTenant(this.db, ctx, (tx) => this.read(tx, ctx, id));
  }

  summaries(ctx: TenantContext, ids: readonly string[]): Promise<TemplateSummary[]> {
    return withTenant(this.db, ctx, async (tx) => {
      const rows = await tx.template.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null, id: { in: [...ids] } },
        include: { _count: { select: { fields: true } } },
      });
      return rows.map((r) => summaryOf(r, r._count.fields));
    });
  }

  private async read(tx: TenantTx, ctx: TenantContext, id: string): Promise<TemplateDetail | null> {
    const row = await tx.template.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: withFields,
    });
    return row ? detailOf(row) : null;
  }

  create(
    ctx: TenantContext,
    input: { name: string; archetype: Archetype; createdById: string },
  ): Promise<TemplateDetail> {
    return withTenant(this.db, ctx, async (tx) => {
      const row = await tx.template.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          archetype: toDbArchetype(input.archetype),
          createdById: input.createdById,
        },
        include: withFields,
      });
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'template.created',
        targetType: 'template',
        targetId: row.id,
      });
      return detailOf(row);
    });
  }

  saveDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    input: { name: string; archetype: Archetype; fields: FieldInput[] },
  ): Promise<WriteResult> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.template.updateMany({
        where: {
          id,
          tenantId: ctx.tenantId,
          deletedAt: null,
          version: expectedVersion,
          status: 'DRAFT',
        },
        data: {
          name: input.name,
          archetype: toDbArchetype(input.archetype),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) return this.whyNotWritten(tx, ctx, id);

      await tx.templateField.deleteMany({ where: { tenantId: ctx.tenantId, templateId: id } });
      if (input.fields.length > 0) {
        await tx.templateField.createMany({ data: fieldRows(ctx, id, input.fields) });
      }
      const template = await this.read(tx, ctx, id);
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'template.updated',
        targetType: 'template',
        targetId: id,
        metadata: { version: template?.version ?? expectedVersion + 1 },
      });
      return template ? { kind: 'ok', template } : { kind: 'not_found' };
    });
  }

  setStatus(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    to: TemplateStatus,
  ): Promise<WriteResult> {
    const from: DbStatus = to === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.template.updateMany({
        where: {
          id,
          tenantId: ctx.tenantId,
          deletedAt: null,
          version: expectedVersion,
          status: from,
        },
        data: {
          status: to,
          publishedAt: to === 'PUBLISHED' ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        const current = await tx.template.findFirst({
          where: { id, tenantId: ctx.tenantId, deletedAt: null },
          select: { status: true },
        });
        if (!current) return { kind: 'not_found' };
        return { kind: current.status === to ? 'same_state' : 'conflict' };
      }
      const template = await this.read(tx, ctx, id);
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: to === 'PUBLISHED' ? 'template.published' : 'template.unpublished',
        targetType: 'template',
        targetId: id,
        metadata: { version: template?.version ?? expectedVersion + 1 },
      });
      return template ? { kind: 'ok', template } : { kind: 'not_found' };
    });
  }

  duplicate(
    ctx: TenantContext,
    id: string,
    input: { name: string; createdById: string },
  ): Promise<TemplateDetail | null> {
    return withTenant(this.db, ctx, async (tx) => {
      const source = await tx.template.findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null },
        include: withFields,
      });
      if (!source) return null;
      const copy = await tx.template.create({
        data: {
          tenantId: ctx.tenantId,
          name: input.name,
          archetype: source.archetype,
          createdById: input.createdById,
        },
      });
      if (source.fields.length > 0) {
        await tx.templateField.createMany({
          data: source.fields.map((f, position) => ({
            tenantId: ctx.tenantId,
            templateId: copy.id,
            position,
            kind: f.kind,
            key: f.key,
            label: f.label,
            helper: f.helper,
            required: f.required,
            options: f.options,
          })),
        });
      }
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'template.duplicated',
        targetType: 'template',
        targetId: copy.id,
        metadata: { sourceId: id },
      });
      return this.read(tx, ctx, copy.id);
    });
  }

  softDelete(ctx: TenantContext, id: string): Promise<'ok' | 'not_found' | 'locked'> {
    return withTenant(this.db, ctx, async (tx) => {
      const updated = await tx.template.updateMany({
        where: { id, tenantId: ctx.tenantId, deletedAt: null, status: 'DRAFT' },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (updated.count === 0) {
        const current = await tx.template.findFirst({
          where: { id, tenantId: ctx.tenantId, deletedAt: null },
          select: { status: true },
        });
        return current ? 'locked' : 'not_found';
      }
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        actorId: ctx.actorId ?? null,
        action: 'template.deleted',
        targetType: 'template',
        targetId: id,
      });
      return 'ok';
    });
  }

  /** Why an UPDATE matched nothing: missing, published (locked), or someone else saved first. */
  private async whyNotWritten(tx: TenantTx, ctx: TenantContext, id: string): Promise<WriteResult> {
    const current = await tx.template.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      select: { status: true },
    });
    if (!current) return { kind: 'not_found' };
    return { kind: current.status === 'PUBLISHED' ? 'locked' : 'conflict' };
  }
}

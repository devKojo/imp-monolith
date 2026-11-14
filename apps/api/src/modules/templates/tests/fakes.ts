import { randomUUID } from 'node:crypto';
import type { TenantContext } from '@/shared/database';
import type { TemplateRepository, WriteResult } from '../application/ports';
import type {
  Archetype,
  FieldInput,
  TemplateDetail,
  TemplateStatus,
  TemplateSummary,
} from '../domain/model';

type Stored = TemplateDetail & { tenantId: string; deleted: boolean };

/** In-memory repository with the same rules as the PostgreSQL one (the contract suite checks both). */
export class InMemoryTemplateRepository implements TemplateRepository {
  private rows: Stored[] = [];
  /** Audit-style record of writes, so tests can see what happened. */
  readonly log: string[] = [];

  private live(ctx: TenantContext, id: string) {
    return this.rows.find((r) => r.id === id && r.tenantId === ctx.tenantId && !r.deleted);
  }
  private strip(row: Stored): TemplateDetail {
    const { tenantId: _t, deleted: _d, ...detail } = row;
    return JSON.parse(JSON.stringify(detail)) as TemplateDetail;
  }
  private touch(row: Stored) {
    row.version += 1;
    row.updatedAt = new Date().toISOString();
  }

  async list(ctx: TenantContext, filter: { status?: TemplateStatus; q?: string }) {
    return this.rows
      .filter((r) => r.tenantId === ctx.tenantId && !r.deleted)
      .filter((r) => !filter.status || r.status === filter.status)
      .filter((r) => !filter.q || r.name.toLowerCase().includes(filter.q.toLowerCase()))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((r): TemplateSummary => {
        const { fields, tenantId: _t, deleted: _d, ...rest } = r;
        return { ...rest, fieldCount: fields.length };
      });
  }

  async get(ctx: TenantContext, id: string) {
    const row = this.live(ctx, id);
    return row ? this.strip(row) : null;
  }

  async summaries(ctx: TenantContext, ids: readonly string[]) {
    return (await this.list(ctx, {})).filter((t) => ids.includes(t.id));
  }

  async create(
    ctx: TenantContext,
    input: { name: string; archetype: Archetype; createdById: string },
  ) {
    const row: Stored = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      deleted: false,
      name: input.name,
      archetype: input.archetype,
      status: 'DRAFT',
      version: 1,
      fields: [],
      updatedAt: new Date().toISOString(),
      publishedAt: null,
    };
    this.rows.push(row);
    this.log.push('created');
    return this.strip(row);
  }

  async saveDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    input: { name: string; archetype: Archetype; fields: FieldInput[] },
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if (row.status === 'PUBLISHED') return { kind: 'locked' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    row.name = input.name;
    row.archetype = input.archetype;
    row.fields = input.fields.map((f) => ({ ...f, id: randomUUID() }));
    this.touch(row);
    this.log.push('updated');
    return { kind: 'ok', template: this.strip(row) };
  }

  async setStatus(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    to: TemplateStatus,
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if (row.status === to) return { kind: 'same_state' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    row.status = to;
    row.publishedAt = to === 'PUBLISHED' ? new Date().toISOString() : null;
    this.touch(row);
    this.log.push(to === 'PUBLISHED' ? 'published' : 'unpublished');
    return { kind: 'ok', template: this.strip(row) };
  }

  async duplicate(ctx: TenantContext, id: string, input: { name: string; createdById: string }) {
    const source = this.live(ctx, id);
    if (!source) return null;
    const copy: Stored = {
      ...JSON.parse(JSON.stringify(source)),
      id: randomUUID(),
      name: input.name,
      status: 'DRAFT',
      version: 1,
      publishedAt: null,
      updatedAt: new Date().toISOString(),
    };
    copy.fields = copy.fields.map((f) => ({ ...f, id: randomUUID() }));
    this.rows.push(copy);
    this.log.push('duplicated');
    return this.strip(copy);
  }

  async softDelete(ctx: TenantContext, id: string) {
    const row = this.live(ctx, id);
    if (!row) return 'not_found' as const;
    if (row.status === 'PUBLISHED') return 'locked' as const;
    row.deleted = true;
    this.log.push('deleted');
    return 'ok' as const;
  }
}

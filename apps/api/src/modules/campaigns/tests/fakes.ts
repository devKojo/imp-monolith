import { randomUUID } from 'node:crypto';
import type { TenantContext } from '@/shared/database';
import { ConflictError } from '@/shared/errors';
import type {
  CampaignRepository,
  DraftContent,
  TemplateLookup,
  WriteResult,
} from '../application/ports';
import type { CampaignSettings, FieldInput } from '../domain/fields';
import type { CampaignStatus, StoredCampaign, StoredSummary, TemplateRef } from '../domain/model';

type Stored = StoredCampaign & { tenantId: string; deleted: boolean };

/** In-memory repository with the same rules as the PostgreSQL one (the contract suite checks both). */
export class InMemoryCampaignRepository implements CampaignRepository {
  private rows: Stored[] = [];
  readonly takenSlugs = new Set<string>();

  private live(ctx: TenantContext, id: string) {
    return this.rows.find((r) => r.id === id && r.tenantId === ctx.tenantId && !r.deleted);
  }
  private strip(row: Stored): StoredCampaign {
    const { tenantId: _t, deleted: _d, ...rest } = row;
    return JSON.parse(JSON.stringify(rest)) as StoredCampaign;
  }
  private touch(row: Stored) {
    row.version += 1;
    row.updatedAt = new Date().toISOString();
  }

  async list(ctx: TenantContext): Promise<StoredSummary[]> {
    return this.rows
      .filter((r) => r.tenantId === ctx.tenantId && !r.deleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((r) => {
        const {
          prizes,
          fields: _f,
          settings: _set,
          summary: _s,
          launchedAt: _l,
          tenantId: _t,
          deleted: _d,
          ...rest
        } = r;
        return {
          ...rest,
          prizeCount: prizes.length,
          maxParticipants: _set.pool?.maxParticipants ?? null,
        };
      });
  }

  async get(ctx: TenantContext, id: string) {
    const row = this.live(ctx, id);
    return row ? this.strip(row) : null;
  }

  async create(
    ctx: TenantContext,
    input: {
      title: string;
      templateId: string | null;
      createdById: string;
      fields: FieldInput[];
      settings: CampaignSettings;
    },
  ) {
    const row: Stored = {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      deleted: false,
      title: input.title,
      summary: '',
      slug: null,
      status: 'DRAFT',
      templateId: input.templateId,
      startAt: null,
      endAt: null,
      prizes: [],
      fields: input.fields.map((f) => ({ ...f, id: randomUUID() })),
      settings: input.settings,
      version: 1,
      updatedAt: new Date().toISOString(),
      launchedAt: null,
      archivedAt: null,
      participantCount: 0,
    };
    this.rows.push(row);
    return this.strip(row);
  }

  async saveDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    content: DraftContent,
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if (row.status !== 'DRAFT' || row.archivedAt) return { kind: 'wrong_state' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    row.title = content.title;
    row.summary = content.summary;
    row.templateId = content.templateId;
    row.startAt = content.startAt ? content.startAt.toISOString() : null;
    row.endAt = content.endAt ? content.endAt.toISOString() : null;
    row.prizes = content.prizes.map((p) => ({ ...p, id: randomUUID() }));
    row.fields = content.fields.map((f) => ({ ...f, id: randomUUID() }));
    row.settings = content.settings;
    this.touch(row);
    return { kind: 'ok', campaign: this.strip(row) };
  }

  async launch(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    input: { status: 'SCHEDULED' | 'LIVE'; slug: string },
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if (row.status !== 'DRAFT' || row.archivedAt) return { kind: 'wrong_state' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    if (this.takenSlugs.has(input.slug)) throw new ConflictError('Resource already exists');
    this.takenSlugs.add(input.slug);
    row.status = input.status;
    row.slug = input.slug;
    row.launchedAt = new Date().toISOString();
    this.touch(row);
    return { kind: 'ok', campaign: this.strip(row) };
  }

  async transition(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    change: { from: CampaignStatus[]; to: CampaignStatus; endAt?: Date },
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if (!change.from.includes(row.status) || row.archivedAt) return { kind: 'wrong_state' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    row.status = change.to;
    if (change.endAt) row.endAt = change.endAt.toISOString();
    this.touch(row);
    return { kind: 'ok', campaign: this.strip(row) };
  }

  /** Test helper: someone has taken part. */
  addParticipants(id: string, n = 1): void {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.participantCount += n;
  }

  async returnToDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if (!['SCHEDULED', 'LIVE', 'PAUSED', 'CANCELLED'].includes(row.status) || row.archivedAt) {
      return { kind: 'wrong_state' };
    }
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    if (row.participantCount > 0) return { kind: 'has_participants' };
    row.status = 'DRAFT';
    row.slug = null;
    this.touch(row);
    return { kind: 'ok', campaign: this.strip(row) };
  }

  async setArchived(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    archived: boolean,
  ): Promise<WriteResult> {
    const row = this.live(ctx, id);
    if (!row) return { kind: 'not_found' };
    if ((row.archivedAt !== null) === archived) return { kind: 'wrong_state' };
    if (row.version !== expectedVersion) return { kind: 'conflict' };
    row.archivedAt = archived ? new Date().toISOString() : null;
    this.touch(row);
    return { kind: 'ok', campaign: this.strip(row) };
  }

  async duplicate(ctx: TenantContext, id: string, input: { title: string; createdById: string }) {
    const source = this.live(ctx, id);
    if (!source) return null;
    const copy: Stored = {
      ...JSON.parse(JSON.stringify(source)),
      id: randomUUID(),
      title: input.title,
      slug: null,
      status: 'DRAFT',
      startAt: null,
      endAt: null,
      version: 1,
      launchedAt: null,
      archivedAt: null,
      participantCount: 0,
      updatedAt: new Date().toISOString(),
    };
    copy.prizes = copy.prizes.map((p) => ({ ...p, id: randomUUID() }));
    copy.fields = copy.fields.map((f) => ({ ...f, id: randomUUID() }));
    this.rows.push(copy);
    return this.strip(copy);
  }

  async softDelete(ctx: TenantContext, id: string) {
    const row = this.live(ctx, id);
    if (!row) return 'not_found' as const;
    if (row.status !== 'DRAFT') return 'locked' as const;
    row.deleted = true;
    return 'ok' as const;
  }
}

/** Templates known to a test, by business. A missing id is simply not returned. */
export class FakeTemplateLookup implements TemplateLookup {
  private known = new Map<string, TemplateRef>();
  add(ref: TemplateRef) {
    this.known.set(ref.id, ref);
    return ref;
  }
  async many(_ctx: TenantContext, ids: readonly string[]) {
    return ids.flatMap((id) => (this.known.has(id) ? [this.known.get(id)!] : []));
  }
}

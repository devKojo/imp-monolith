import { randomBytes, randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import { ConflictError } from '@/shared/errors';
import type {
  CreateCampaignInput,
  ListQuery,
  UpdateCampaignInput,
} from '../contracts/campaigns.schemas';
import {
  CampaignInvalidError,
  CampaignLockedError,
  CampaignNotFoundError,
  CampaignPermissionError,
  CampaignStateError,
  NoActiveBusinessError,
  PreflightFailedError,
  VersionConflictError,
} from '../domain/errors';
import type {
  Actor,
  CampaignDetail,
  CampaignSummary,
  StoredCampaign,
  TemplateRef,
} from '../domain/model';
import { LIMITS } from '../domain/model';
import { canManageCampaigns, canOperateCampaigns, canReadCampaigns } from '../domain/permissions';
import {
  effectiveStatus,
  failedChecks,
  normalizePrizes,
  runningStatusFor,
  slugify,
  withEffectiveStatus,
} from '../domain/rules';
import type { CampaignRepository, TemplateLookup, WriteResult } from './ports';

type Need = 'read' | 'operate' | 'manage';
const CHECKS: Record<Need, (role: string) => boolean> = {
  read: canReadCampaigns,
  operate: canOperateCampaigns,
  manage: canManageCampaigns,
};

/**
 * Campaign workflows. Each method resolves the tenant from the actor (never from input), checks the
 * role, applies the campaign rules, and leaves the atomic write to the repository. Authorisation is
 * decided here once, so no route can forget it (R-ARC-08).
 */
export class CampaignsService {
  constructor(
    private readonly repo: CampaignRepository,
    private readonly templates: TemplateLookup,
    private readonly now: () => Date = () => new Date(),
    /** Random part of a new page address; replaceable so tests are deterministic. */
    private readonly suffix: () => string = () => randomBytes(3).toString('hex'),
  ) {}

  private scope(actor: Actor | null, need: Need): TenantContext {
    if (!actor) throw new NoActiveBusinessError();
    if (!CHECKS[need](actor.role)) throw new CampaignPermissionError();
    return createTenantContext({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      requestId: randomUUID(),
    });
  }

  private async refs(ctx: TenantContext, ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    const found = await this.templates.many(ctx, unique);
    return new Map(found.map((t) => [t.id, t]));
  }

  private async detail(ctx: TenantContext, row: StoredCampaign): Promise<CampaignDetail> {
    const refs = await this.refs(ctx, [row.templateId]);
    return {
      ...withEffectiveStatus(row, this.now()),
      template: row.templateId ? (refs.get(row.templateId) ?? null) : null,
    };
  }

  async list(actor: Actor | null, query: ListQuery): Promise<CampaignSummary[]> {
    const ctx = this.scope(actor, 'read');
    const rows = await this.repo.list(ctx);
    const refs = await this.refs(
      ctx,
      rows.map((r) => r.templateId),
    );
    const now = this.now();
    const needle = query.q?.toLowerCase();
    return rows
      .map((r) => ({
        ...withEffectiveStatus(r, now),
        template: r.templateId ? (refs.get(r.templateId) ?? null) : null,
      }))
      .filter((r) => !query.status || r.status === query.status)
      .filter((r) => !needle || r.title.toLowerCase().includes(needle));
  }

  async get(actor: Actor | null, id: string): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'read');
    return this.detail(ctx, await this.load(ctx, id));
  }

  async create(actor: Actor | null, input: CreateCampaignInput): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'manage');
    const templateId = input.templateId ?? null;
    await this.requireTemplate(ctx, templateId);
    const row = await this.repo.create(ctx, {
      title: input.title,
      templateId,
      createdById: actor!.userId,
    });
    return this.detail(ctx, row);
  }

  async update(
    actor: Actor | null,
    id: string,
    input: UpdateCampaignInput,
  ): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'manage');
    const startAt = input.startAt ? new Date(input.startAt) : null;
    const endAt = input.endAt ? new Date(input.endAt) : null;
    if (startAt && endAt && endAt <= startAt) {
      throw new CampaignInvalidError('The end must be after the start', { field: 'endAt' });
    }
    await this.requireTemplate(ctx, input.templateId);
    const result = await this.repo.saveDraft(ctx, id, input.expectedVersion, {
      title: input.title,
      summary: input.summary.trim(),
      templateId: input.templateId,
      startAt,
      endAt,
      prizes: normalizePrizes(input.prizes),
    });
    return this.detail(
      ctx,
      this.settle(result, () => new CampaignLockedError()),
    );
  }

  /**
   * Launching is decided on the server: it reads the stored campaign and its template, runs the
   * checks, and writes only if nobody changed it in between. The public address is made from the
   * title and a short random part, retried if it happens to be taken.
   */
  async launch(actor: Actor | null, id: string, expectedVersion: number): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'manage');
    const current = await this.load(ctx, id);
    if (current.version !== expectedVersion) throw new VersionConflictError();
    if (current.status !== 'DRAFT')
      throw new CampaignStateError('The campaign is already launched');

    const template = await this.templateOf(ctx, current.templateId);
    const now = this.now();
    const startAt = current.startAt ? new Date(current.startAt) : null;
    const failed = failedChecks(
      {
        title: current.title,
        template,
        startAt,
        endAt: current.endAt ? new Date(current.endAt) : null,
        prizes: current.prizes,
      },
      now,
    );
    if (failed.length > 0) throw new PreflightFailedError({ failed: failed.map((c) => c.id) });

    const status = runningStatusFor(startAt, now);
    const base = slugify(current.title);
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await this.repo.launch(ctx, id, expectedVersion, {
          status,
          slug: `${base}-${this.suffix()}`,
        });
        return this.detail(
          ctx,
          this.settle(result, () => new CampaignStateError('The campaign is already launched')),
        );
      } catch (err) {
        if (err instanceof ConflictError && attempt < 5) continue; // the address was taken
        throw err;
      }
    }
  }

  async pause(actor: Actor | null, id: string, expectedVersion: number): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'operate');
    await this.running(ctx, id, ['SCHEDULED', 'LIVE'], 'Only a running campaign can be paused');
    return this.moved(ctx, id, expectedVersion, ['SCHEDULED', 'LIVE'], 'PAUSED');
  }

  async resume(actor: Actor | null, id: string, expectedVersion: number): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'operate');
    const current = await this.load(ctx, id);
    const now = this.now();
    const startAt = current.startAt ? new Date(current.startAt) : null;
    const endAt = current.endAt ? new Date(current.endAt) : null;
    if (effectiveStatus(current.status, startAt, endAt, now) !== 'PAUSED') {
      throw new CampaignStateError('Only a paused campaign can be resumed');
    }
    return this.moved(ctx, id, expectedVersion, ['PAUSED'], runningStatusFor(startAt, now));
  }

  async cancel(actor: Actor | null, id: string, expectedVersion: number): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'manage');
    await this.running(
      ctx,
      id,
      ['SCHEDULED', 'LIVE', 'PAUSED'],
      'Only a campaign that has not ended can be cancelled',
    );
    return this.moved(ctx, id, expectedVersion, ['SCHEDULED', 'LIVE', 'PAUSED'], 'CANCELLED');
  }

  async duplicate(actor: Actor | null, id: string, title?: string): Promise<CampaignDetail> {
    const ctx = this.scope(actor, 'manage');
    const source = await this.load(ctx, id);
    const copy = await this.repo.duplicate(ctx, id, {
      title: (title ?? `${source.title} (copy)`).slice(0, LIMITS.titleMax),
      createdById: actor!.userId,
    });
    if (!copy) throw new CampaignNotFoundError();
    return this.detail(ctx, copy);
  }

  async remove(actor: Actor | null, id: string): Promise<void> {
    const ctx = this.scope(actor, 'manage');
    const outcome = await this.repo.softDelete(ctx, id);
    if (outcome === 'not_found') throw new CampaignNotFoundError();
    if (outcome === 'locked') throw new CampaignLockedError();
  }

  private async load(ctx: TenantContext, id: string): Promise<StoredCampaign> {
    const row = await this.repo.get(ctx, id);
    if (!row) throw new CampaignNotFoundError();
    return row;
  }

  /** The campaign must be, as people see it now, in one of `allowed` (so an ended one is refused). */
  private async running(
    ctx: TenantContext,
    id: string,
    allowed: Array<StoredCampaign['status']>,
    message: string,
  ): Promise<StoredCampaign> {
    const row = await this.load(ctx, id);
    const effective = withEffectiveStatus(row, this.now()).status;
    if (!allowed.includes(effective)) throw new CampaignStateError(message);
    return row;
  }

  private async moved(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    from: Array<StoredCampaign['status']>,
    to: StoredCampaign['status'],
  ): Promise<CampaignDetail> {
    return this.detail(
      ctx,
      this.settle(await this.repo.transition(ctx, id, expectedVersion, { from, to })),
    );
  }

  private async templateOf(ctx: TenantContext, id: string | null): Promise<TemplateRef | null> {
    if (!id) return null;
    return (await this.refs(ctx, [id])).get(id) ?? null;
  }

  /** A campaign can only point at a template of its own business that still exists. */
  private async requireTemplate(ctx: TenantContext, id: string | null): Promise<void> {
    if (id && !(await this.templateOf(ctx, id))) {
      throw new CampaignInvalidError('That template is not available', { field: 'templateId' });
    }
  }

  /** `wrongState` is what the caller's action means when the campaign is not in the state it needs. */
  private settle(
    result: WriteResult,
    wrongState: () => Error = () =>
      new CampaignStateError('The campaign cannot be changed from its current state'),
  ): StoredCampaign {
    switch (result.kind) {
      case 'ok':
        return result.campaign;
      case 'not_found':
        throw new CampaignNotFoundError();
      case 'conflict':
        throw new VersionConflictError();
      case 'wrong_state':
        throw wrongState();
    }
  }
}

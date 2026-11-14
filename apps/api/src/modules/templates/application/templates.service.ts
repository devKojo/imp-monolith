import { randomUUID } from 'node:crypto';
import { createTenantContext, type TenantContext } from '@/shared/database';
import type {
  ListQuery,
  UpdateTemplateInput,
  CreateTemplateInput,
} from '../contracts/templates.schemas';
import {
  NoActiveBusinessError,
  PreflightFailedError,
  TemplateInUseError,
  TemplateLockedError,
  TemplateNotFoundError,
  TemplatePermissionError,
  TemplateRuleError,
  TemplateStateError,
  VersionConflictError,
} from '../domain/errors';
import { LIMITS, type Actor, type TemplateDetail, type TemplateSummary } from '../domain/model';
import { canManageTemplates, canReadTemplates } from '../domain/permissions';
import { duplicateKeys, failedChecks, normalizeFields } from '../domain/rules';
import type { TemplateRepository, TemplateUsage, WriteResult } from './ports';

/**
 * Template workflows. Each method resolves the tenant from the actor (never from input), checks the
 * role, applies the template rules, and leaves the atomic write to the repository. Authorisation is
 * decided here once, so no route can forget it (R-ARC-08).
 */
export class TemplatesService {
  constructor(
    private readonly repo: TemplateRepository,
    private readonly usage?: TemplateUsage,
  ) {}

  private scope(actor: Actor | null, need: 'read' | 'manage'): TenantContext {
    if (!actor) throw new NoActiveBusinessError();
    const allowed =
      need === 'manage' ? canManageTemplates(actor.role) : canReadTemplates(actor.role);
    if (!allowed) throw new TemplatePermissionError();
    return createTenantContext({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      requestId: randomUUID(),
    });
  }

  async list(actor: Actor | null, query: ListQuery): Promise<TemplateSummary[]> {
    const ctx = this.scope(actor, 'read');
    return this.repo.list(ctx, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
    });
  }

  async get(actor: Actor | null, id: string): Promise<TemplateDetail> {
    const ctx = this.scope(actor, 'read');
    const template = await this.repo.get(ctx, id);
    if (!template) throw new TemplateNotFoundError();
    return template;
  }

  async create(actor: Actor | null, input: CreateTemplateInput): Promise<TemplateDetail> {
    const ctx = this.scope(actor, 'manage');
    return this.repo.create(ctx, {
      name: input.name,
      archetype: input.archetype,
      createdById: actor!.userId,
    });
  }

  async update(
    actor: Actor | null,
    id: string,
    input: UpdateTemplateInput,
  ): Promise<TemplateDetail> {
    const ctx = this.scope(actor, 'manage');
    const fields = normalizeFields(input.fields);
    const dupes = duplicateKeys(fields);
    if (dupes.length > 0) {
      throw new TemplateRuleError('Field names must be unique', { duplicateKeys: dupes });
    }
    if (fields.length > LIMITS.fieldsMax) throw new TemplateRuleError('Too many fields');
    return this.settle(
      await this.repo.saveDraft(ctx, id, input.expectedVersion, {
        name: input.name,
        archetype: input.archetype,
        fields,
      }),
    );
  }

  /**
   * Publishing is decided on the server: it reads the stored template, runs the checks, and writes
   * only if nobody changed it in between (the write carries the version that was checked).
   */
  async publish(actor: Actor | null, id: string, expectedVersion: number): Promise<TemplateDetail> {
    const ctx = this.scope(actor, 'manage');
    const current = await this.repo.get(ctx, id);
    if (!current) throw new TemplateNotFoundError();
    if (current.version !== expectedVersion) throw new VersionConflictError();
    if (current.status === 'PUBLISHED')
      throw new TemplateStateError('The template is already published');
    const failed = failedChecks(current.fields);
    if (failed.length > 0) throw new PreflightFailedError({ failed: failed.map((c) => c.id) });
    return this.settle(await this.repo.setStatus(ctx, id, expectedVersion, 'PUBLISHED'));
  }

  async unpublish(
    actor: Actor | null,
    id: string,
    expectedVersion: number,
  ): Promise<TemplateDetail> {
    const ctx = this.scope(actor, 'manage');
    if (await this.usage?.isInUse(ctx, id)) throw new TemplateInUseError();
    return this.settle(await this.repo.setStatus(ctx, id, expectedVersion, 'DRAFT'));
  }

  async duplicate(actor: Actor | null, id: string, name?: string): Promise<TemplateDetail> {
    const ctx = this.scope(actor, 'manage');
    const source = await this.repo.get(ctx, id);
    if (!source) throw new TemplateNotFoundError();
    const copy = await this.repo.duplicate(ctx, id, {
      name: (name ?? `${source.name} (copy)`).slice(0, LIMITS.nameMax),
      createdById: actor!.userId,
    });
    if (!copy) throw new TemplateNotFoundError();
    return copy;
  }

  async remove(actor: Actor | null, id: string): Promise<void> {
    const ctx = this.scope(actor, 'manage');
    if (await this.usage?.isInUse(ctx, id)) throw new TemplateInUseError();
    const outcome = await this.repo.softDelete(ctx, id);
    if (outcome === 'not_found') throw new TemplateNotFoundError();
    if (outcome === 'locked') throw new TemplateLockedError();
  }

  /** Templates by id for other modules (campaigns): only what the business can see, no fields. */
  async summariesFor(ctx: TenantContext, ids: readonly string[]): Promise<TemplateSummary[]> {
    return ids.length === 0 ? [] : this.repo.summaries(ctx, ids);
  }

  private settle(result: WriteResult): TemplateDetail {
    switch (result.kind) {
      case 'ok':
        return result.template;
      case 'not_found':
        throw new TemplateNotFoundError();
      case 'conflict':
        throw new VersionConflictError();
      case 'locked':
        throw new TemplateLockedError();
      case 'same_state':
        throw new TemplateStateError('The template is already in that state');
    }
  }
}

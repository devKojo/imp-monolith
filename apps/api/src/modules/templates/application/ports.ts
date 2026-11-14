import type { TenantContext } from '@/shared/database';
import type {
  Archetype,
  FieldInput,
  TemplateDetail,
  TemplateStatus,
  TemplateSummary,
} from '../domain/model';

/**
 * Outcome of a write that carries the version the caller read. The repository decides atomically
 * (the version and status are part of the UPDATE's WHERE clause), so two people saving at once
 * cannot both win.
 */
export type WriteResult =
  | { kind: 'ok'; template: TemplateDetail }
  | { kind: 'not_found' }
  | { kind: 'conflict' }
  | { kind: 'locked' }
  | { kind: 'same_state' };

/** Storage for templates. Every method runs inside one tenant-scoped transaction (RLS). */
export interface TemplateRepository {
  list(
    ctx: TenantContext,
    filter: { status?: TemplateStatus; q?: string },
  ): Promise<TemplateSummary[]>;
  get(ctx: TenantContext, id: string): Promise<TemplateDetail | null>;
  /** Summaries of the given templates that exist in this business (missing or deleted ones are left out). */
  summaries(ctx: TenantContext, ids: readonly string[]): Promise<TemplateSummary[]>;
  create(
    ctx: TenantContext,
    input: { name: string; archetype: Archetype; createdById: string },
  ): Promise<TemplateDetail>;
  /** Replaces name, archetype and the whole field set of a DRAFT at `expectedVersion`. */
  saveDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    input: { name: string; archetype: Archetype; fields: FieldInput[] },
  ): Promise<WriteResult>;
  /** DRAFT to PUBLISHED, or back, at `expectedVersion`. */
  setStatus(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    to: TemplateStatus,
  ): Promise<WriteResult>;
  /** A new DRAFT copy of the template (own ids), or null if the source does not exist. */
  duplicate(
    ctx: TenantContext,
    id: string,
    input: { name: string; createdById: string },
  ): Promise<TemplateDetail | null>;
  /** Soft delete of a DRAFT. */
  softDelete(ctx: TenantContext, id: string): Promise<'ok' | 'not_found' | 'locked'>;
}

/**
 * Answers whether a template is relied on by something that is running, so it must not be unpublished
 * or deleted. Provided by the module that owns the dependants (campaigns) at the composition root, so
 * templates never reads another module's tables.
 */
export interface TemplateUsage {
  isInUse(ctx: TenantContext, templateId: string): Promise<boolean>;
}

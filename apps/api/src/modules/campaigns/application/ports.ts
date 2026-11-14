import type { TenantContext } from '@/shared/database';
import type {
  CampaignStatus,
  PrizeInput,
  StoredCampaign,
  StoredSummary,
  TemplateRef,
} from '../domain/model';

/**
 * Outcome of a write that carries the version the caller read. The repository decides atomically
 * (the version and the allowed statuses are part of the UPDATE's WHERE clause), so two people acting
 * at once cannot both win.
 */
export type WriteResult =
  | { kind: 'ok'; campaign: StoredCampaign }
  | { kind: 'not_found' }
  | { kind: 'conflict' }
  | { kind: 'wrong_state' };

export type DraftContent = {
  title: string;
  summary: string;
  templateId: string | null;
  startAt: Date | null;
  endAt: Date | null;
  prizes: PrizeInput[];
};

/** Storage for campaigns. Every method runs inside one tenant-scoped transaction (RLS). */
export interface CampaignRepository {
  list(ctx: TenantContext): Promise<StoredSummary[]>;
  get(ctx: TenantContext, id: string): Promise<StoredCampaign | null>;
  create(
    ctx: TenantContext,
    input: { title: string; templateId: string | null; createdById: string },
  ): Promise<StoredCampaign>;
  /** Replaces the content of a DRAFT at `expectedVersion`; `wrong_state` if it is not a draft. */
  saveDraft(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    content: DraftContent,
  ): Promise<WriteResult>;
  /** DRAFT to SCHEDULED or LIVE, fixing the public address. Throws ConflictError if the slug is taken. */
  launch(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    input: { status: 'SCHEDULED' | 'LIVE'; slug: string },
  ): Promise<WriteResult>;
  /** Moves a campaign from one of `from` to `to` at `expectedVersion`; `wrong_state` otherwise. */
  transition(
    ctx: TenantContext,
    id: string,
    expectedVersion: number,
    change: { from: CampaignStatus[]; to: CampaignStatus },
  ): Promise<WriteResult>;
  /** A new DRAFT copy (own ids, no schedule, no address), or null if the source does not exist. */
  duplicate(
    ctx: TenantContext,
    id: string,
    input: { title: string; createdById: string },
  ): Promise<StoredCampaign | null>;
  /** Soft delete of a DRAFT. */
  softDelete(ctx: TenantContext, id: string): Promise<'ok' | 'not_found' | 'locked'>;
}

/** Looks up the templates a campaign uses. Provided by the templates module at the composition root. */
export interface TemplateLookup {
  many(ctx: TenantContext, ids: readonly string[]): Promise<TemplateRef[]>;
}

import { uuidv7 } from '@/shared/uuid';
import type { TenantTx } from './with-tenant';

export type AuditEntry = {
  tenantId: string | null;
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Identifiers and versions only; never PII or business content (R-PRV-06). */
  metadata?: Record<string, string | number>;
};

/**
 * Appends to the audit trail inside the caller's transaction (R-SEC-04). The table is INSERT-only
 * for application roles, so this uses a plain INSERT without RETURNING.
 */
export const writeAudit = (tx: TenantTx, e: AuditEntry) =>
  tx.$executeRaw`INSERT INTO audit_log (id, tenant_id, actor_id, action, target_type, target_id, metadata)
    VALUES (${uuidv7()}::uuid, ${e.tenantId}::uuid, ${e.actorId}::uuid, ${e.action},
            ${e.targetType ?? null}, ${e.targetId ?? null}::uuid,
            ${JSON.stringify(e.metadata ?? {})}::jsonb)`;

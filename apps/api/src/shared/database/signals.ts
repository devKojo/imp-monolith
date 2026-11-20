import { uuidv7 } from '@/shared/uuid';
import { currentSignals } from '../request-signals';
import type { TenantTx } from './with-tenant';

export type SignalInput = {
  tenantId: string;
  campaignId: string;
  userId: string;
  kind: 'JOIN' | 'CLAIM';
};

/**
 * Records the current request's abuse-detection signals in the caller's transaction, so a signal exists
 * exactly when the participation does. Hashes only (see `request-signals`). Insert-only for the runtime role.
 */
export const recordSignal = (tx: TenantTx, s: SignalInput) => {
  const { ipHash, uaHash } = currentSignals();
  return tx.$executeRaw`INSERT INTO participation_signals (id, tenant_id, campaign_id, user_id, kind, ip_hash, ua_hash)
    VALUES (${uuidv7()}::uuid, ${s.tenantId}::uuid, ${s.campaignId}::uuid, ${s.userId}::uuid,
            ${s.kind}::"SignalKind", ${ipHash}, ${uaHash})`;
};

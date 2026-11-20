import { uuidv7 } from '@/shared/uuid';
import type { TenantTx } from '@/shared/database';

/**
 * Points are an append-only ledger: a balance is the sum of its entries and is never stored or edited. An
 * entry carries an idempotency key, so a retry or a double click cannot credit the same award twice. The
 * runtime role has no UPDATE or DELETE on the table.
 */

export type LedgerEntry = {
  tenantId: string;
  userId: string;
  /** The award this entry settles, if any. */
  awardId?: string;
  /** Positive to credit, negative to spend; never zero. */
  delta: number;
  reason: string;
  /** Stable per intended change, for example `award:<id>`. A second entry with the same key does nothing. */
  idempotencyKey: string;
};

/** Appends one entry in the caller's transaction. Returns false when that key was already recorded. */
export async function appendPoints(tx: TenantTx, e: LedgerEntry): Promise<boolean> {
  if (!Number.isSafeInteger(e.delta) || e.delta === 0) {
    throw new RangeError('A points entry must be a non-zero whole number');
  }
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO points_ledger (id, tenant_id, user_id, award_id, delta, reason, idempotency_key)
    VALUES (${uuidv7()}::uuid, ${e.tenantId}::uuid, ${e.userId}::uuid, ${e.awardId ?? null}::uuid,
            ${e.delta}, ${e.reason}, ${e.idempotencyKey})
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

/** A participant's points with this business: the sum of their entries. */
export async function pointsBalance(
  tx: TenantTx,
  tenantId: string,
  userId: string,
): Promise<number> {
  const sum = await tx.pointsLedger.aggregate({
    where: { tenantId, userId },
    _sum: { delta: true },
  });
  return Number(sum._sum.delta ?? 0);
}

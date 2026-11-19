import type { PrismaClient } from '@/generated/prisma/client';
import { isUuid } from '@/shared/uuid';
import { runScoped, type TenantTx, type WithTenantOptions } from './with-tenant';

/**
 * Read scope for a signed-in person's own participation across businesses (their quiz attempts and
 * survey responses, and the campaigns those belong to). It sets the transaction-local
 * `app.participant_user_id` that opens the read-only `participant_read` RLS policies. The id must come
 * from the session, never from the request. Use only to read the person's own participation.
 */
export function withParticipant<T>(
  db: PrismaClient,
  userId: string,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantOptions = {},
): Promise<T> {
  if (!isUuid(userId)) throw new TypeError('userId must be a UUID');
  return runScoped(db, [['app.participant_user_id', userId]], fn, opts);
}

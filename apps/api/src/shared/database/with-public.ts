import type { PrismaClient } from '@/generated/prisma/client';
import { runScoped, type TenantTx, type WithTenantOptions } from './with-tenant';

/**
 * Read scope for the public listing: published campaigns across businesses, nothing else. It sets the
 * transaction-local `app.public_read` that opens the read-only `public_read` RLS policies (campaigns
 * that are running, their prizes, the template kind, the business name). It carries no tenant and no
 * user, so it cannot reach a draft, a paused campaign, a template's fields or anything private.
 * Use only for the unauthenticated public endpoints, and only to read.
 */
export function withPublic<T>(
  db: PrismaClient,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantOptions = {},
): Promise<T> {
  return runScoped(db, [['app.public_read', 'on']], fn, opts);
}

import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { isWriteConflict, mapPrismaError } from './errors';
import type { TenantContext } from './tenant-context';

export const MAX_WAIT_MS = 2000; // R-DAT-07
export const MAX_TIMEOUT_MS = 5000;
export const MAX_ATTEMPTS = 3; // bounded P2034 retry

export type TenantTx = Prisma.TransactionClient;

export type WithTenantOptions = {
  /** Transaction timeout; capped at 5 s unless an override is recorded in code review. */
  timeoutMs?: number;
  /** Test seam: backoff sleeper. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The only way to touch tenant tables (R-TEN-03). Opens an interactive transaction on the
 * app_runtime client, sets the transaction-local `app.tenant_id` so RLS applies, and hands the
 * transaction client to `fn`. With no tenant set the policies return zero rows (fail closed).
 *
 * No network I/O (HTTP, S3, SMTP, SMS) may happen inside `fn` (R-DAT-07). Because `fn` can be
 * re-run on P2034, it must be safe to repeat: do side effects through the outbox.
 */
export async function withTenant<T>(
  db: PrismaClient,
  ctx: TenantContext,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantOptions = {},
): Promise<T> {
  const timeout = Math.min(opts.timeoutMs ?? MAX_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const sleep = opts.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`;
          return fn(tx);
        },
        { maxWait: MAX_WAIT_MS, timeout },
      );
    } catch (err) {
      if (isWriteConflict(err) && attempt < MAX_ATTEMPTS) {
        // Jittered exponential backoff: 20-40 ms, then 40-80 ms.
        await sleep(20 * 2 ** (attempt - 1) * (1 + Math.random()));
        continue;
      }
      throw mapPrismaError(err);
    }
  }
}

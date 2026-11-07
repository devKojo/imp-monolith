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
 * Shared implementation: opens an interactive transaction, sets transaction-local scope settings
 * (`app.tenant_id`, `app.user_id`, ...) that the RLS policies read, then runs `fn`. Retries
 * P2034 (bounded, jittered) and maps Prisma errors to domain errors. Because `fn` can be re-run,
 * it must be safe to repeat; no network I/O inside it (R-DAT-07).
 */
export async function runScoped<T>(
  db: PrismaClient,
  settings: ReadonlyArray<readonly [name: string, value: string]>,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantOptions = {},
): Promise<T> {
  const timeout = Math.min(opts.timeoutMs ?? MAX_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const sleep = opts.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          for (const [name, value] of settings) {
            await tx.$executeRaw`SELECT set_config(${name}, ${value}, true)`;
          }
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

/**
 * The only way to touch tenant tables (R-TEN-03). Sets the transaction-local `app.tenant_id` so
 * RLS applies. With no tenant set the policies return zero rows (fail closed).
 */
export function withTenant<T>(
  db: PrismaClient,
  ctx: TenantContext,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantOptions = {},
): Promise<T> {
  return runScoped(db, [['app.tenant_id', ctx.tenantId]], fn, opts);
}

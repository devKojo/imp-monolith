import { describe, expect, it, vi } from 'vitest';
import { ConflictError } from '@/shared/errors';
import type { PrismaClient } from '@/generated/prisma/client';
import { DatabaseBusyError, TransactionConflictError, mapPrismaError } from './errors';
import { createTenantContext } from './tenant-context';
import { MAX_ATTEMPTS, MAX_TIMEOUT_MS, MAX_WAIT_MS, withTenant } from './with-tenant';
import { isUuid } from '@/shared/uuid';

const TENANT = '0197a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const prismaError = (code: string) => Object.assign(new Error(code), { code });

function fakeDb(
  transaction: (fn: (tx: unknown) => Promise<unknown>, opts: unknown) => Promise<unknown>,
) {
  return { $transaction: vi.fn(transaction) } as unknown as PrismaClient & {
    $transaction: ReturnType<typeof vi.fn>;
  };
}

describe('uuid helpers', () => {
  it('accepts uuids and rejects everything else', () => {
    expect(isUuid(TENANT)).toBe(true);
    expect(isUuid('123')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('createTenantContext', () => {
  it('requires a UUID tenantId and actorId', () => {
    expect(() => createTenantContext({ tenantId: 'not-a-uuid', requestId: 'r' })).toThrow(
      TypeError,
    );
    expect(() => createTenantContext({ tenantId: TENANT, actorId: 'x', requestId: 'r' })).toThrow(
      TypeError,
    );
    expect(createTenantContext({ tenantId: TENANT, requestId: 'r' }).tenantId).toBe(TENANT);
  });
});

describe('mapPrismaError', () => {
  it('maps P2002, P2024 and P2034 to domain errors and passes others through', () => {
    expect(mapPrismaError(prismaError('P2002'))).toBeInstanceOf(ConflictError);
    expect(mapPrismaError(prismaError('P2024'))).toBeInstanceOf(DatabaseBusyError);
    expect(mapPrismaError(prismaError('P2034'))).toBeInstanceOf(TransactionConflictError);
    const other = new Error('boom');
    expect(mapPrismaError(other)).toBe(other);
  });
});

describe('withTenant', () => {
  const ctx = createTenantContext({ tenantId: TENANT, requestId: 'req-1' });
  const noSleep = async () => {};

  it('sets app.tenant_id inside the transaction with R-DAT-07 limits', async () => {
    const executed: unknown[][] = [];
    const tx = { $executeRaw: async (...args: unknown[]) => void executed.push(args) };
    const db = fakeDb((fn) => fn(tx));
    const result = await withTenant(db, ctx, async () => 'ok');
    expect(result).toBe('ok');
    expect(executed).toHaveLength(1);
    expect(executed[0]![1]).toBe('app.tenant_id');
    expect(executed[0]![2]).toBe(TENANT); // tenant id bound as a parameter, not interpolated
    expect(db.$transaction.mock.calls[0]![1]).toEqual({
      maxWait: MAX_WAIT_MS,
      timeout: MAX_TIMEOUT_MS,
    });
  });

  it('caps the timeout at 5 s', async () => {
    const db = fakeDb((fn) => fn({ $executeRaw: async () => 1 }));
    await withTenant(db, ctx, async () => 1, { timeoutMs: 60_000 });
    expect(db.$transaction.mock.calls[0]![1]).toMatchObject({ timeout: MAX_TIMEOUT_MS });
  });

  it('retries P2034 up to 3 attempts, then maps it', async () => {
    const db = fakeDb(async () => {
      throw prismaError('P2034');
    });
    await expect(withTenant(db, ctx, async () => 1, { sleep: noSleep })).rejects.toBeInstanceOf(
      TransactionConflictError,
    );
    expect(db.$transaction).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it('succeeds when a retry succeeds', async () => {
    let calls = 0;
    const db = fakeDb(async (fn) => {
      if (++calls < 2) throw prismaError('P2034');
      return fn({ $executeRaw: async () => 1 });
    });
    await expect(withTenant(db, ctx, async () => 'done', { sleep: noSleep })).resolves.toBe('done');
    expect(calls).toBe(2);
  });

  it('does not retry other errors', async () => {
    const db = fakeDb(async () => {
      throw prismaError('P2002');
    });
    await expect(withTenant(db, ctx, async () => 1, { sleep: noSleep })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

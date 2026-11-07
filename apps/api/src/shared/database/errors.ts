import { AppError, ConflictError } from '@/shared/errors';

/** Pool/transaction wait exceeded (Prisma P2024): the system is saturated, callers should back off. */
export class DatabaseBusyError extends AppError {
  constructor(message = 'Database is busy, retry shortly') {
    super(message, 503, 'DATABASE_BUSY');
  }
}

/** Write conflict / deadlock (Prisma P2034) that survived the bounded retries. */
export class TransactionConflictError extends ConflictError {
  constructor(message = 'Concurrent update conflict, retry') {
    super(message);
  }
}

export const PRISMA_UNIQUE_VIOLATION = 'P2002';
export const PRISMA_POOL_TIMEOUT = 'P2024';
export const PRISMA_WRITE_CONFLICT = 'P2034';

function codeOf(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** Map Prisma errors to domain errors (R-DAT-07). Unknown errors pass through unchanged. */
export function mapPrismaError(err: unknown): unknown {
  switch (codeOf(err)) {
    case PRISMA_UNIQUE_VIOLATION:
      return new ConflictError('Resource already exists');
    case PRISMA_POOL_TIMEOUT:
      return new DatabaseBusyError();
    case PRISMA_WRITE_CONFLICT:
      return new TransactionConflictError();
    default:
      return err;
  }
}

export const isWriteConflict = (err: unknown): boolean => codeOf(err) === PRISMA_WRITE_CONFLICT;

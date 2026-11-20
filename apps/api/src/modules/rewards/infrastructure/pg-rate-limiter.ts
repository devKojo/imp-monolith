import type { PrismaClient } from '@/generated/prisma/client';
import { TooManyClaimsError, type RateLimit } from './attempt-limiter';

/**
 * A fixed-window limit kept in PostgreSQL, so it holds across server instances (ADR-R001 decision 9). One
 * atomic upsert counts the attempt and returns the new count, so concurrent requests cannot slip past. A
 * fixed window allows a short burst at a window boundary (up to twice the limit); that is the price of one
 * cheap statement. It fails closed: if the store is unreachable the request fails rather than going
 * unlimited. Keys are opaque ids and hold no personal data.
 */
export class PgRateLimiter implements RateLimit {
  constructor(
    private readonly db: PrismaClient,
    private readonly scope: string,
    private readonly max: number,
    private readonly windowMs: number,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async hit(key: string): Promise<void> {
    const now = this.clock().getTime();
    const start = new Date(Math.floor(now / this.windowMs) * this.windowMs);
    const rows = await this.db.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_counters (key, window_start, count)
      VALUES (${`${this.scope}:${key}`}, ${start}, 1)
      ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_counters.count + 1
      RETURNING count`;
    if ((rows[0]?.count ?? 1) > this.max) {
      throw new TooManyClaimsError(
        Math.max(1, Math.ceil((start.getTime() + this.windowMs - now) / 1000)),
      );
    }
    // Old windows are no use to anyone; tidy a few at a time so the table stays small.
    if (Math.random() < 0.02) await this.prune(now);
  }

  private async prune(now: number): Promise<void> {
    const cutoff = new Date(now - 2 * 86_400_000);
    try {
      await this.db.$executeRaw`DELETE FROM rate_limit_counters WHERE window_start < ${cutoff}`;
    } catch {
      // Housekeeping only; the next run will try again.
    }
  }
}

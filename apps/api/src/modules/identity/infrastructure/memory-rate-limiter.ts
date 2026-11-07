import type { Clock, LoginRateLimiter } from '../application/ports';
import { TooManyRequestsError } from '../domain/errors';

/**
 * In-process sliding-window limiter, per instance. A shared (Redis) limiter that fails closed onto
 * this one replaces it when Redis is introduced (R-RDS-02); the port stays the same.
 */
export class MemoryRateLimiter implements LoginRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly clock: Clock = () => new Date(),
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.clock().getTime() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.hits.delete(key);
    else this.hits.set(key, list);
    return list;
  }

  assertAllowed(key: string): void {
    const list = this.recent(key);
    if (list.length >= this.max) {
      const retry = Math.ceil((list[0]! + this.windowMs - this.clock().getTime()) / 1000);
      throw new TooManyRequestsError(Math.max(retry, 1));
    }
  }

  recordFailure(key: string): void {
    const list = this.recent(key);
    list.push(this.clock().getTime());
    this.hits.set(key, list);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

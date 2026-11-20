import { AppError } from '@/shared/errors';

export class TooManyClaimsError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many attempts, try again later', 429, 'RATE_LIMITED');
  }
}

/**
 * A per-person sliding-window limit on claim attempts. In-process for now, so it holds per instance; the
 * shared, store-backed limiter in R5 replaces it behind the same two calls.
 */
export class AttemptLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Counts this attempt, or throws when the person has made too many. */
  hit(key: string): void {
    const now = this.clock().getTime();
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      throw new TooManyClaimsError(
        Math.max(1, Math.ceil(((recent[0] as number) + this.windowMs - now) / 1000)),
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}

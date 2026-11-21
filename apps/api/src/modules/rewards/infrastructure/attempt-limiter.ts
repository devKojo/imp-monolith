import { AppError } from '@/shared/errors';

/** Counts one attempt for a key, or throws `TooManyClaimsError` when the key has made too many. */
export interface RateLimit {
  hit(key: string): Promise<void>;
}

export class TooManyClaimsError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many attempts, try again later', 429, 'RATE_LIMITED');
  }
}

/**
 * A per-key sliding-window limit, in process: it holds per instance. The shared limiter
 * (`PgRateLimiter`) is what runs in production; this one is for tests and single-instance use.
 */
export class AttemptLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Counts this attempt, or throws when the person has made too many. */
  hit(key: string): Promise<void> {
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
    return Promise.resolve();
  }
}

import { availableParallelism } from 'node:os';
import argon2 from 'argon2';
import type { PasswordHasher } from '../application/ports';
import { ServiceBusyError } from '../domain/errors';

/**
 * Argon2id at the OWASP minimum configuration (19 MiB, t=2, p=1). Benchmark on target hardware
 * and raise before launch (R-IAM-04).
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  raw: false as const,
};

/** Bounded concurrency; when saturated callers get 503 + Retry-After instead of stalling. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly limit: number,
    private readonly maxQueue: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      if (this.waiters.length >= this.maxQueue) throw new ServiceBusyError(1);
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      this.active++;
    }
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next)
        next(); // hand the slot straight to the next waiter
      else this.active--;
    }
  }
}

export class Argon2Hasher implements PasswordHasher {
  private readonly gate: Semaphore;
  private dummy: Promise<string> | undefined;

  constructor(concurrency: number = Math.max(1, availableParallelism() - 1)) {
    this.gate = new Semaphore(concurrency, concurrency * 4);
  }

  hash(password: string): Promise<string> {
    return this.gate.run(() => argon2.hash(password, ARGON2_OPTIONS));
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    // Unknown users are verified against a real hash so response time is the same.
    this.dummy ??= argon2.hash('dummy-password-for-timing', ARGON2_OPTIONS);
    const target = hash ?? (await this.dummy);
    const ok = await this.gate.run(() => argon2.verify(target, password).catch(() => false));
    return hash !== null && ok;
  }
}

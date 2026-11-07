import { createHash } from 'node:crypto';
import type { BreachedPasswordChecker } from '../application/ports';

/**
 * Have I Been Pwned range API (k-anonymity): only the first 5 hex chars of the SHA-1 leave the
 * process. 3 s timeout (R-API-06). If the service is unreachable the check fails open and warns,
 * so an outage of a third party cannot block registration; revisit if policy requires fail-closed.
 */
export class HibpBreachChecker implements BreachedPasswordChecker {
  constructor(
    private readonly baseUrl = 'https://api.pwnedpasswords.com',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (!res.ok) throw new Error(`HIBP responded ${res.status}`);
      const body = await res.text();
      return body.split('\n').some((line) => {
        const [hash, count] = line.trim().split(':');
        return hash === suffix && Number(count) > 0; // padded entries have count 0
      });
    } catch (err) {
      console.warn('breached-password check unavailable, allowing:', (err as Error).message);
      return false;
    }
  }
}

import { describe, expect, it } from 'vitest';
import {
  canTransition,
  creditsAtClaim,
  effectiveState,
  needsDestination,
  validateDestination,
} from '../domain/claim';
import { AttemptLimiter, TooManyClaimsError } from '../infrastructure/attempt-limiter';
import { SecretBox } from '../infrastructure/secret-box';

describe('award states', () => {
  it('moves only along the allowed steps', () => {
    expect(canTransition('AVAILABLE', 'CLAIMED')).toBe(true);
    expect(canTransition('CLAIMED', 'FULFILLED')).toBe(true);
    expect(canTransition('HELD', 'AVAILABLE')).toBe(true);
    // Final states stay final, and nothing skips the claim.
    expect(canTransition('FULFILLED', 'AVAILABLE')).toBe(false);
    expect(canTransition('EXPIRED', 'CLAIMED')).toBe(false);
    expect(canTransition('REVOKED', 'AVAILABLE')).toBe(false);
    expect(canTransition('AVAILABLE', 'FULFILLED')).toBe(false);
    expect(canTransition('PENDING_REVIEW', 'CLAIMED')).toBe(false);
  });

  it('reads an unclaimed award past its deadline as expired', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const past = new Date('2026-05-31T00:00:00Z');
    const future = new Date('2026-06-02T00:00:00Z');
    expect(effectiveState('AVAILABLE', past, now)).toBe('EXPIRED');
    expect(effectiveState('AVAILABLE', future, now)).toBe('AVAILABLE');
    // A claimed award does not expire.
    expect(effectiveState('CLAIMED', past, now)).toBe('CLAIMED');
    expect(effectiveState('HELD', past, now)).toBe('HELD');
  });

  it('credits points at once, and asks for a destination only for money and items', () => {
    expect(needsDestination('POINTS')).toBe(false);
    expect(needsDestination('CASH')).toBe(true);
    expect(needsDestination('ITEM')).toBe(true);
    expect(creditsAtClaim('POINTS', 40)).toBe(true);
    expect(creditsAtClaim('POINTS', null)).toBe(false);
    expect(creditsAtClaim('CASH', 40)).toBe(false);
  });
});

describe('validateDestination', () => {
  const ok = (r: ReturnType<typeof validateDestination>) => {
    if (!r.ok) throw new Error(r.problem);
    return r.value;
  };

  it('normalises a mobile money number so the same number matches however it is typed', () => {
    const a = ok(
      validateDestination({
        method: 'MOBILE_MONEY',
        destination: '+233 24-123 4567',
        accountName: ' Ama  Mensah ',
      }),
    );
    const b = ok(
      validateDestination({
        method: 'MOBILE_MONEY',
        destination: '+233241234567',
        accountName: 'Ama Mensah',
      }),
    );
    expect(a.destination).toBe('+233241234567');
    expect(a.destination).toBe(b.destination);
    expect(a.accountName).toBe('Ama Mensah');
    expect(a.hint).toBe('••••4567');
  });

  it('refuses what cannot be a destination, and says what to fix', () => {
    const bad = (input: Parameters<typeof validateDestination>[0]) => {
      const r = validateDestination(input);
      expect(r.ok).toBe(false);
      return r.ok ? '' : r.problem;
    };
    expect(bad({ destination: '0241234567', accountName: 'Ama' })).toMatch(/how you want/);
    expect(bad({ method: 'MOBILE_MONEY', destination: 'abc', accountName: 'Ama' })).toMatch(
      /mobile money/,
    );
    expect(bad({ method: 'MOBILE_MONEY', destination: '12345', accountName: 'Ama' })).toMatch(
      /mobile money/,
    );
    expect(bad({ method: 'BANK_TRANSFER', destination: '12', accountName: 'Ama' })).toMatch(
      /account number/,
    );
    expect(bad({ method: 'MOBILE_MONEY', destination: '0241234567', accountName: ' ' })).toMatch(
      /name/,
    );
    expect(bad({ method: 'DELIVERY', destination: 'short', accountName: 'Ama' })).toMatch(
      /address/,
    );
  });

  it('accepts a delivery address as free text', () => {
    const v = ok(
      validateDestination({
        method: 'DELIVERY',
        destination: '12  Ring Road, Accra',
        accountName: 'Ama',
      }),
    );
    expect(v.destination).toBe('12 Ring Road, Accra');
  });
});

describe('SecretBox', () => {
  const box = new SecretBox('a-long-enough-server-secret');

  it('round-trips, and never stores the value in clear', () => {
    const sealed = box.encrypt('+233241234567');
    expect(sealed).not.toContain('233241234567');
    expect(box.decrypt(sealed)).toBe('+233241234567');
  });
  it('gives a different ciphertext every time', () => {
    expect(box.encrypt('same')).not.toBe(box.encrypt('same'));
  });
  it('detects tampering and a wrong key', () => {
    const sealed = box.encrypt('secret');
    const [v, iv, tag, body] = sealed.split(':');
    const flipped = Buffer.from(body as string, 'base64');
    flipped[0] = (flipped[0] as number) ^ 1;
    expect(() => box.decrypt([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
    expect(() => new SecretBox('another-long-server-secret').decrypt(sealed)).toThrow();
  });
  it('fingerprints equal values equally, without revealing them', () => {
    expect(box.fingerprint('MOBILE_MONEY:+233241234567')).toBe(
      box.fingerprint('MOBILE_MONEY:+233241234567'),
    );
    expect(box.fingerprint('MOBILE_MONEY:+233241234567')).not.toBe(
      box.fingerprint('BANK_TRANSFER:+233241234567'),
    );
    expect(box.fingerprint('x')).toMatch(/^[0-9a-f]{32}$/);
    expect(box.fingerprint('x')).not.toBe(
      new SecretBox('another-long-server-secret').fingerprint('x'),
    );
  });
  it('refuses a weak key', () => {
    expect(() => new SecretBox('short')).toThrow();
  });
});

describe('AttemptLimiter', () => {
  it('allows a few attempts per person, then waits, then allows again', () => {
    let now = new Date('2026-01-01T00:00:00Z');
    const limiter = new AttemptLimiter(2, 60_000, () => now);
    limiter.hit('a');
    limiter.hit('a');
    expect(() => limiter.hit('a')).toThrow(TooManyClaimsError);
    // Someone else is not affected.
    expect(() => limiter.hit('b')).not.toThrow();
    now = new Date(now.getTime() + 61_000);
    expect(() => limiter.hit('a')).not.toThrow();
  });
});

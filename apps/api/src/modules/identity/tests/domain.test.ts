import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../domain/email';
import { isLocked, lockedUntil } from '../domain/login-throttle';
import { passwordProblems } from '../domain/password-policy';
import {
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  isSessionActive,
  shouldTouch,
} from '../domain/session-policy';
import { csrfTokenFor, generateToken, hashToken, safeEqual } from '../domain/tokens';
import { isUuid, uuidv7 } from '@/shared/uuid';
import { parseCookies, sessionCookie } from '../http/cookies';

const t0 = new Date('2026-11-07T10:00:00Z');
const plus = (ms: number) => new Date(t0.getTime() + ms);

describe('email normalisation', () => {
  it('trims, lower-cases and punycodes the domain', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(normalizeEmail('ada@bücher.example')).toBe('ada@xn--bcher-kva.example');
  });
});

describe('password policy', () => {
  it('requires 12-128 characters and rejects the email name', () => {
    expect(passwordProblems('short', 'a@b.co')).not.toEqual([]);
    expect(passwordProblems('x'.repeat(129), 'a@b.co')).not.toEqual([]);
    expect(passwordProblems('correct horse battery', 'ada@b.co')).toEqual([]);
    expect(passwordProblems('my-ada-lovelace-pw1', 'ada.lovelace@b.co')).toEqual([]);
    expect(passwordProblems('ada.lovelace-secret', 'ada.lovelace@b.co')).not.toEqual([]);
    expect(passwordProblems('aaaaaaaaaaaaaaaa', 'q@b.co')).not.toEqual([]);
  });
});

describe('session policy (idle 30 min, absolute 12 h)', () => {
  const base = { lastSeenAt: t0, expiresAt: plus(SESSION_ABSOLUTE_MS), revokedAt: null };
  it('is active inside both windows', () => {
    expect(isSessionActive(base, plus(SESSION_IDLE_MS - 1))).toBe(true);
  });
  it('expires when idle for 30 minutes', () => {
    expect(isSessionActive(base, plus(SESSION_IDLE_MS))).toBe(false);
  });
  it('expires at the absolute limit even if recently seen', () => {
    const s = { ...base, lastSeenAt: plus(SESSION_ABSOLUTE_MS - 1000) };
    expect(isSessionActive(s, plus(SESSION_ABSOLUTE_MS))).toBe(false);
  });
  it('is never active once revoked', () => {
    expect(isSessionActive({ ...base, revokedAt: t0 }, t0)).toBe(false);
  });
  it('throttles last-seen writes to once a minute', () => {
    expect(shouldTouch(t0, plus(30_000))).toBe(false);
    expect(shouldTouch(t0, plus(60_000))).toBe(true);
  });
});

describe('login throttle', () => {
  it('locks only from the 5th failure with progressive, capped duration', () => {
    expect(lockedUntil(4, t0)).toBeNull();
    expect(lockedUntil(5, t0)).toEqual(plus(15 * 60_000));
    expect(lockedUntil(6, t0)).toEqual(plus(30 * 60_000));
    expect(lockedUntil(8, t0)).toEqual(plus(120 * 60_000));
    expect(lockedUntil(50, t0)).toEqual(plus(120 * 60_000));
  });
  it('reports lock state by time', () => {
    expect(isLocked(plus(1000), t0)).toBe(true);
    expect(isLocked(t0, t0)).toBe(false);
    expect(isLocked(null, t0)).toBe(false);
  });
});

describe('tokens', () => {
  it('generates distinct 256-bit tokens and hashes them deterministically', () => {
    const a = generateToken();
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(a).not.toBe(generateToken());
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('derives a CSRF token bound to the session and secret', () => {
    const h = hashToken('s1');
    expect(csrfTokenFor('k'.repeat(32), h)).toBe(csrfTokenFor('k'.repeat(32), h));
    expect(csrfTokenFor('k'.repeat(32), h)).not.toBe(csrfTokenFor('k'.repeat(32), hashToken('s2')));
    expect(csrfTokenFor('k'.repeat(32), h)).not.toBe(csrfTokenFor('j'.repeat(32), h));
  });
  it('compares in constant time and handles length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('uuidv7', () => {
  it('is a valid v7 uuid and time-ordered', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_001_000);
    expect(isUuid(a)).toBe(true);
    expect(a[14]).toBe('7');
    expect('89ab').toContain(a[19]);
    expect(a < b).toBe(true);
  });
});

describe('cookies', () => {
  it('parses cookie headers', () => {
    expect(parseCookies('a=1; __Host-sid=tok; b=2')).toMatchObject({ '__Host-sid': 'tok', a: '1' });
    expect(parseCookies(undefined)).toEqual({});
  });
  it('builds a hardened session cookie', () => {
    const c = sessionCookie('tok', plus(3600_000), t0);
    expect(c).toContain('__Host-sid=tok');
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=3600']) {
      expect(c).toContain(attr);
    }
    expect(c).not.toContain('Domain'); // required by the __Host- prefix
  });
});

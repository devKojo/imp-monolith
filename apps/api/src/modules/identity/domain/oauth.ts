import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Short-lived, signed record of one OAuth attempt, kept in a cookie between start and callback. */
export type OAuthAttempt = { state: string; nonce: string; verifier: string; expiresAt: number };

export const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;

const b64 = (b: Buffer) => b.toString('base64url');

export function newOAuthAttempt(now: Date): OAuthAttempt & { challenge: string } {
  const verifier = b64(randomBytes(32));
  return {
    state: b64(randomBytes(24)),
    nonce: b64(randomBytes(24)),
    verifier,
    // PKCE S256 (RFC 7636).
    challenge: b64(createHash('sha256').update(verifier).digest()),
    expiresAt: now.getTime() + OAUTH_ATTEMPT_TTL_MS,
  };
}

const sign = (secret: string, body: string) =>
  b64(createHmac('sha256', secret).update(body).digest());

export function sealAttempt(secret: string, a: OAuthAttempt): string {
  const body = b64(Buffer.from(JSON.stringify(a)));
  return `${body}.${sign(secret, body)}`;
}

/** Returns the attempt only if the signature is valid and it has not expired. */
export function openAttempt(
  secret: string,
  sealed: string | undefined,
  now: Date,
): OAuthAttempt | null {
  if (!sealed) return null;
  const [body, mac] = sealed.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const a = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthAttempt;
    if (!a.state || !a.nonce || !a.verifier || a.expiresAt <= now.getTime()) return null;
    return a;
  } catch {
    return null;
  }
}

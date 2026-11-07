import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Opaque 256-bit token, base64url (R-IAM-01). */
export const generateToken = (): string => randomBytes(32).toString('base64url');

/** Only hashes of tokens are stored; a database leak does not yield usable sessions. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Session-bound CSRF token: HMAC of the session's token hash. Rotates whenever the session does. */
export const csrfTokenFor = (secret: string, sessionTokenHash: string): string =>
  createHmac('sha256', secret).update(`csrf:${sessionTokenHash}`).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

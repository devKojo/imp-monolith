/** Cookie name uses the __Host- prefix: Secure, Path=/, no Domain (R-IAM-01, R-WEB-01). */
export const SESSION_COOKIE = '__Host-sid';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name && !(name in out)) out[name] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token: string, expiresAt: Date, now: Date = new Date()): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/** Holds the signed OAuth attempt between start and callback (10 minutes, Lax so it survives the redirect back). */
export const OAUTH_COOKIE = '__Host-oauth';

export const oauthAttemptCookie = (value: string): string =>
  `${OAUTH_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;

export const clearedOAuthCookie = (): string =>
  `${OAUTH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export const clearedSessionCookie = (): string =>
  `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

import type { GoogleClaims, GoogleIdentityProvider } from '../application/ports';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** Must match an authorised redirect URI of the OAuth client exactly. */
  redirectUri: string;
  fetch?: typeof fetch;
};

/**
 * Authorization-code flow with PKCE. The ID token comes straight from Google's token endpoint over
 * TLS, which OpenID Connect Core 3.1.3.7 accepts in place of a signature check; its claims are still
 * validated (issuer, audience, expiry, nonce, verified email).
 */
export class GoogleOAuth implements GoogleIdentityProvider {
  private readonly http: typeof fetch;

  constructor(private readonly cfg: GoogleOAuthConfig) {
    this.http = cfg.fetch ?? fetch;
  }

  authorizeUrl(i: { state: string; nonce: string; codeChallenge: string }): string {
    const q = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: i.state,
      nonce: i.nonce,
      code_challenge: i.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${q.toString()}`;
  }

  async exchange(i: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleClaims> {
    const res = await this.http(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: i.code,
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        redirect_uri: this.cfg.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: i.codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`token endpoint returned ${res.status}`);
    const { id_token: idToken } = (await res.json()) as { id_token?: string };
    const payload = idToken?.split('.')[1];
    if (!payload) throw new Error('no id_token');
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;

    if (!ISSUERS.includes(String(c.iss))) throw new Error('bad issuer');
    if (c.aud !== this.cfg.clientId) throw new Error('bad audience');
    if (typeof c.exp !== 'number' || c.exp * 1000 <= Date.now()) throw new Error('expired');
    if (c.nonce !== i.nonce) throw new Error('bad nonce');
    if (typeof c.sub !== 'string' || typeof c.email !== 'string') throw new Error('missing claims');
    return {
      sub: c.sub,
      email: c.email,
      emailVerified: c.email_verified === true || c.email_verified === 'true',
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : c.email.split('@')[0]!,
    };
  }
}

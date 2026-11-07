import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler, notFound } from '@/shared/http';
import { AuthService } from '../application/auth.service';
import type { GoogleClaims, GoogleIdentityProvider } from '../application/ports';
import { newOAuthAttempt, openAttempt, sealAttempt } from '../domain/oauth';
import { authRouter } from '../http/auth.routes';
import { GoogleOAuth } from '../infrastructure/google-oauth';
import { MemoryRateLimiter } from '../infrastructure/memory-rate-limiter';
import { SmtpMailer } from '../infrastructure/smtp-mailer';
import { FakeBreached, FakeHasher, FakeIdentityRepository, FakeMailer } from './fakes';

const SECRET = 'k'.repeat(32);
const ORIGIN = 'https://app.example.test';

class FakeGoogle implements GoogleIdentityProvider {
  claims: GoogleClaims = {
    sub: 'g-1',
    email: 'Pat@Example.com',
    emailVerified: true,
    name: 'Pat',
  };
  fail = false;
  last: { nonce: string; codeVerifier: string } | null = null;
  authorizeUrl(i: { state: string; nonce: string; codeChallenge: string }) {
    return `https://accounts.example.test/auth?state=${i.state}&nonce=${i.nonce}&c=${i.codeChallenge}`;
  }
  async exchange(i: { code: string; codeVerifier: string; nonce: string }) {
    this.last = { nonce: i.nonce, codeVerifier: i.codeVerifier };
    if (this.fail || i.code !== 'good') throw new Error('bad code');
    return this.claims;
  }
}

function setup(withGoogle = true) {
  const repo = new FakeIdentityRepository();
  const google = new FakeGoogle();
  const auth = new AuthService({
    repo,
    hasher: new FakeHasher(),
    breached: new FakeBreached(new Set()),
    mailer: new FakeMailer(),
    google: withGoogle ? google : undefined,
    loginLimiter: new MemoryRateLimiter(50, 60_000),
    registerLimiter: new MemoryRateLimiter(50, 60_000),
    resendIpLimiter: new MemoryRateLimiter(50, 60_000),
    resendEmailLimiter: new MemoryRateLimiter(50, 60_000),
    resendCooldown: new MemoryRateLimiter(50, 60_000),
    csrfSecret: SECRET,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter(auth, { allowedOrigins: [ORIGIN] }));
  app.use(notFound);
  app.use(errorHandler);
  return { repo, google, auth, app };
}

/** Runs /google/start and returns the state parameter and the attempt cookie to send back. */
async function start(app: express.Express) {
  const res = await request(app).get('/api/v1/auth/google/start').expect(302);
  const url = new URL(res.headers.location as string);
  const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
    c.startsWith('__Host-oauth='),
  )!;
  return { state: url.searchParams.get('state')!, cookie: cookie.split(';')[0]! };
}

describe('OAuth attempt cookie', () => {
  it('round-trips, and rejects tampering, a wrong key and expiry', () => {
    const now = new Date('2026-11-07T10:00:00Z');
    const a = newOAuthAttempt(now);
    const sealed = sealAttempt(SECRET, a);
    expect(openAttempt(SECRET, sealed, now)?.state).toBe(a.state);
    expect(openAttempt('x'.repeat(32), sealed, now)).toBeNull();
    const flipped = sealed.slice(0, -1) + (sealed.endsWith('A') ? 'B' : 'A');
    expect(openAttempt(SECRET, flipped, now)).toBeNull();
    expect(openAttempt(SECRET, undefined, now)).toBeNull();
    expect(openAttempt(SECRET, sealed, new Date(now.getTime() + 11 * 60_000))).toBeNull();
  });
});

describe('Sign in with Google routes', () => {
  it('is 404 when Google is not configured', async () => {
    await request(setup(false).app).get('/api/v1/auth/google/start').expect(404);
  });

  it('starts by redirecting to Google with a state, nonce and PKCE challenge', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/v1/auth/google/start').expect(302);
    const url = new URL(res.headers.location as string);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(url.searchParams.get('c')).toBeTruthy();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('__Host-oauth=');
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
  });

  it('creates a verified participant on first sign-in and starts a session', async () => {
    const { app, repo, google } = setup();
    const { state, cookie } = await start(app);
    const res = await request(app)
      .get(`/api/v1/auth/google/callback?code=good&state=${state}`)
      .set('Cookie', cookie)
      .expect(302);
    expect(res.headers.location).toBe('/me');
    expect(String(res.headers['set-cookie'])).toContain('__Host-sid=');
    const user = repo.users.get('pat@example.com')!;
    expect(user.accountType).toBe('PARTICIPANT');
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeNull();
    expect(google.last?.codeVerifier).toBeTruthy();
  });

  it('signs in an existing verified participant without creating another account', async () => {
    const { app, repo } = setup();
    await repo.registerGoogleParticipant({ userId: 'u1', email: 'pat@example.com', name: 'Pat' });
    const { state, cookie } = await start(app);
    await request(app)
      .get(`/api/v1/auth/google/callback?code=good&state=${state}`)
      .set('Cookie', cookie)
      .expect(302)
      .expect('Location', '/me');
    expect(repo.users.size).toBe(1);
  });

  it('adopts an unverified pre-registered account and discards its password', async () => {
    const { app, repo } = setup();
    await repo.registerParticipant({
      userId: 'u1',
      email: 'pat@example.com',
      name: 'Squatter',
      passwordHash: 'attacker-password-hash',
      agreementVersion: '1.0',
      verificationTokenHash: 'h',
      verificationExpiresAt: new Date(Date.now() + 1000),
    });
    const { state, cookie } = await start(app);
    await request(app)
      .get(`/api/v1/auth/google/callback?code=good&state=${state}`)
      .set('Cookie', cookie)
      .expect('Location', '/me');
    const user = repo.users.get('pat@example.com')!;
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeNull();
  });

  it('refuses a business account and sends the person to the sign-in page', async () => {
    const { app, repo } = setup();
    await repo.registerOwner({
      userId: 'u1',
      tenantId: 't1',
      membershipId: 'm1',
      email: 'pat@example.com',
      name: 'Pat',
      passwordHash: 'x',
      businessName: 'Acme',
      agreementVersion: '1.0',
      verificationTokenHash: 'h',
      verificationExpiresAt: new Date(Date.now() + 1000),
    });
    const { state, cookie } = await start(app);
    const res = await request(app)
      .get(`/api/v1/auth/google/callback?code=good&state=${state}`)
      .set('Cookie', cookie)
      .expect(302);
    expect(res.headers.location).toBe('/signin?error=google_business');
    expect(String(res.headers['set-cookie'])).not.toContain('__Host-sid=');
  });

  it.each([
    ['a wrong state', (s: string) => `code=good&state=${s}x`, true],
    ['no attempt cookie', (s: string) => `code=good&state=${s}`, false],
    ['a bad code', (s: string) => `code=bad&state=${s}`, true],
    ['an error from Google', (s: string) => `error=access_denied&state=${s}`, true],
  ])('fails closed on %s', async (_name, query, sendCookie) => {
    const { app, repo } = setup();
    const { state, cookie } = await start(app);
    const req = request(app).get(`/api/v1/auth/google/callback?${query(state)}`);
    const res = await (sendCookie ? req.set('Cookie', cookie) : req).expect(302);
    expect(res.headers.location).toBe('/signin?error=google');
    expect(String(res.headers['set-cookie'])).not.toContain('__Host-sid=');
    expect(repo.users.size).toBe(0);
  });

  it('refuses an email Google has not verified', async () => {
    const { app, repo, google } = setup();
    google.claims = { ...google.claims, emailVerified: false };
    const { state, cookie } = await start(app);
    const res = await request(app)
      .get(`/api/v1/auth/google/callback?code=good&state=${state}`)
      .set('Cookie', cookie)
      .expect(302);
    expect(res.headers.location).toBe('/signin?error=google');
    expect(repo.users.size).toBe(0);
  });
});

describe('GoogleOAuth ID token validation', () => {
  const idToken = (claims: Record<string, unknown>) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
  const good = {
    iss: 'https://accounts.google.com',
    aud: 'client-id',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'n1',
    sub: 's1',
    email: 'a@b.test',
    email_verified: true,
    name: 'Ada',
  };
  const make = (claims: Record<string, unknown>, ok = true) =>
    new GoogleOAuth({
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: `${ORIGIN}/api/v1/auth/google/callback`,
      fetch: (async () =>
        new Response(JSON.stringify({ id_token: idToken(claims) }), {
          status: ok ? 200 : 400,
        })) as typeof fetch,
    });
  const input = { code: 'c', codeVerifier: 'v', nonce: 'n1' };

  it('accepts a valid token and builds the authorization URL with PKCE', async () => {
    const g = make(good);
    await expect(g.exchange(input)).resolves.toMatchObject({
      email: 'a@b.test',
      emailVerified: true,
    });
    const url = new URL(g.authorizeUrl({ state: 's', nonce: 'n', codeChallenge: 'c' }));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('client_id')).toBe('client-id');
  });

  it.each([
    ['issuer', { ...good, iss: 'https://evil.test' }],
    ['audience', { ...good, aud: 'other' }],
    ['expiry', { ...good, exp: 1 }],
    ['nonce', { ...good, nonce: 'other' }],
    ['subject', { ...good, sub: undefined }],
  ])('rejects a bad %s', async (_n, claims) => {
    await expect(make(claims).exchange(input)).rejects.toThrow();
  });

  it('rejects when the token endpoint errors', async () => {
    await expect(make(good, false).exchange(input)).rejects.toThrow();
  });
});

describe('SmtpMailer', () => {
  it('sends the verification link built from the public URL', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const mailer = new SmtpMailer({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'sender@gmail.test',
      pass: 'app-password',
      from: 'IMP <sender@gmail.test>',
      publicUrl: 'https://imp.example.test/',
      transport: { sendMail } as never,
    });
    await mailer.sendVerificationEmail('pat@example.com', 'tok/en+1');
    const msg = sendMail.mock.calls[0]![0] as { to: string; from: string; text: string };
    expect(msg.to).toBe('pat@example.com');
    expect(msg.from).toBe('IMP <sender@gmail.test>');
    expect(msg.text).toContain('https://imp.example.test/verify-email?token=tok%2Fen%2B1');
  });
});

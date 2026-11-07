import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { errorHandler, notFound } from '@/shared/http';
import { AuthService } from '../application/auth.service';
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from '../domain/session-policy';
import { authRouter } from '../http/auth.routes';
import { MemoryRateLimiter } from '../infrastructure/memory-rate-limiter';
import { FakeBreached, FakeHasher, FakeIdentityRepository, FakeMailer } from './fakes';

const ORIGIN = 'https://app.example.test';
const PASSWORD = 'correct horse battery';
const agreement = { accepted: true, version: '1.0' };
const body = {
  name: 'Ada',
  email: 'Ada@Example.com',
  password: PASSWORD,
  businessName: 'Acme',
  agreement,
};

function setup() {
  let now = new Date('2026-11-07T10:00:00Z');
  const repo = new FakeIdentityRepository();
  const mailer = new FakeMailer();
  const hasher = new FakeHasher();
  const clock = () => now;
  const auth = new AuthService({
    repo,
    hasher,
    breached: new FakeBreached(new Set(['password1234567'])),
    mailer,
    loginLimiter: new MemoryRateLimiter(3, 15 * 60_000, clock),
    registerLimiter: new MemoryRateLimiter(100, 60 * 60_000, clock),
    resendIpLimiter: new MemoryRateLimiter(10, 60 * 60_000, clock),
    resendEmailLimiter: new MemoryRateLimiter(3, 60 * 60_000, clock),
    resendCooldown: new MemoryRateLimiter(1, 60_000, clock),
    csrfSecret: 'k'.repeat(32),
    clock,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter(auth, { allowedOrigins: [ORIGIN] }));
  app.use(notFound);
  app.use(errorHandler);
  return {
    app,
    repo,
    mailer,
    hasher,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

const cookieOf = (res: request.Response): string => {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '';
  return raw.split(';')[0]!;
};

describe('identity HTTP', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  const post = (path: string, data?: object) =>
    request(s.app).post(`/api/v1/auth${path}`).set('Origin', ORIGIN).send(data);

  async function registerAndVerify() {
    await post('/register', body).expect(202);
    await post('/verify-email', { token: s.mailer.sent[0]!.token }).expect(204);
  }
  async function login() {
    const res = await post('/login', { email: 'ada@example.com', password: PASSWORD }).expect(200);
    return { cookie: cookieOf(res), csrf: res.body.csrfToken as string, res };
  }

  describe('register and verify', () => {
    it('creates the account, mails a token and normalises the email', async () => {
      const res = await post('/register', body).expect(202);
      expect(res.body).toEqual({ status: 'verification_sent' });
      expect(s.mailer.sent).toHaveLength(1);
      expect(s.mailer.sent[0]!.to).toBe('ada@example.com');
      expect(s.repo.users.has('ada@example.com')).toBe(true);
    });

    it('responds identically for an existing email and sends nothing (no enumeration)', async () => {
      await post('/register', body).expect(202);
      const again = await post('/register', body).expect(202);
      expect(again.body).toEqual({ status: 'verification_sent' });
      expect(s.mailer.sent).toHaveLength(1);
    });

    it('rejects weak and breached passwords with 422', async () => {
      await post('/register', { ...body, password: 'short' }).expect(422);
      await post('/register', { ...body, password: 'password1234567' }).expect(422);
      expect(s.repo.users.size).toBe(0);
    });

    it('requires the agreement to be accepted (R-PRV-01)', async () => {
      const { agreement: _omit, ...withoutAgreement } = body;
      await post('/register', withoutAgreement).expect(400);
      await post('/register', { ...body, agreement: { accepted: false, version: '1.0' } }).expect(
        400,
      );
      await post('/register', { ...body, agreement: { accepted: true } }).expect(400);
      expect(s.repo.users.size).toBe(0);
    });

    it('rejects unknown keys (strict schema)', async () => {
      await post('/register', { ...body, role: 'admin' }).expect(400);
    });

    it('verification tokens are single-use and expire', async () => {
      await post('/register', body).expect(202);
      const token = s.mailer.sent[0]!.token;
      await post('/verify-email', { token }).expect(204);
      await post('/verify-email', { token }).expect(400);
      await post('/register', { ...body, email: 'b@example.com' }).expect(202);
      s.advance(25 * 60 * 60_000);
      await post('/verify-email', { token: s.mailer.sent[1]!.token }).expect(400);
    });
  });

  describe('resend verification', () => {
    const tick = () => new Promise((r) => setImmediate(r));

    it('sends a fresh working link to an unverified address', async () => {
      await post('/register', body).expect(202);
      s.advance(61_000);
      await post('/resend-verification', { email: 'ADA@example.com' }).expect(202);
      await tick();
      expect(s.mailer.sent).toHaveLength(2);
      expect(s.mailer.sent[1]!.to).toBe('ada@example.com');
      expect(s.mailer.sent[1]!.token).not.toBe(s.mailer.sent[0]!.token);
      await post('/verify-email', { token: s.mailer.sent[1]!.token }).expect(204);
    });

    it('answers the same and sends nothing for unknown and already verified addresses', async () => {
      await registerAndVerify();
      const unknown = await post('/resend-verification', { email: 'nobody@example.com' }).expect(
        202,
      );
      s.advance(61_000);
      const verified = await post('/resend-verification', { email: 'ada@example.com' }).expect(202);
      await tick();
      expect(unknown.body).toEqual(verified.body);
      expect(s.mailer.sent).toHaveLength(1); // only the original registration mail
    });

    it('allows one resend per address per minute, with Retry-After', async () => {
      await post('/register', body).expect(202);
      await post('/resend-verification', { email: 'ada@example.com' }).expect(202);
      const res = await post('/resend-verification', { email: 'ada@example.com' }).expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      s.advance(61_000);
      await post('/resend-verification', { email: 'ada@example.com' }).expect(202);
    });

    it('limits an address to three resends an hour, known or not', async () => {
      for (let i = 0; i < 3; i++) {
        await post('/resend-verification', { email: 'ghost@example.com' }).expect(202);
        s.advance(61_000);
      }
      await post('/resend-verification', { email: 'ghost@example.com' }).expect(429);
    });

    it('rejects a malformed address', async () => {
      await post('/resend-verification', { email: 'not-an-email' }).expect(400);
    });
  });

  describe('login', () => {
    it('requires a verified email', async () => {
      await post('/register', body).expect(202);
      const res = await post('/login', { email: 'ada@example.com', password: PASSWORD });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('issues a hardened __Host-sid cookie, a csrf token and the memberships', async () => {
      await registerAndVerify();
      const { res } = await login();
      const set = (res.headers['set-cookie'] as unknown as string[])[0]!;
      expect(set).toMatch(/^__Host-sid=[\w-]{43};/);
      for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(set).toContain(a);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.csrfToken).toBeTruthy();
      expect(res.body.memberships[0]).toMatchObject({
        businessName: 'Acme',
        role: 'BUSINESS_OWNER',
      });
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    });

    it('gives the same response for wrong password and unknown email, and verifies both', async () => {
      await registerAndVerify();
      const before = s.hasher.calls;
      const wrong = await post('/login', { email: 'ada@example.com', password: 'nope-nope-nope' });
      const unknown = await post('/login', {
        email: 'who@example.com',
        password: 'nope-nope-nope',
      });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(s.hasher.calls - before).toBe(2); // unknown users still cost a verification
    });

    it('locks the account after 5 failures, even for the right password, without revealing it', async () => {
      await registerAndVerify();
      for (let i = 0; i < 5; i++) {
        s.advance(60_000); // spread out so the per-IP limiter (3 / 15 min) is not what trips
        s.advance(15 * 60_000);
        await post('/login', { email: 'ada@example.com', password: 'bad-bad-bad-bad' }).expect(401);
      }
      expect(s.repo.isLockedNow('ada@example.com', new Date(Date.now()))).toBeDefined();
      const res = await post('/login', { email: 'ada@example.com', password: PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rate limits by IP with 429 and Retry-After', async () => {
      for (let i = 0; i < 3; i++) {
        await post('/login', { email: 'x@example.com', password: 'bad-bad-bad-bad' }).expect(401);
      }
      const res = await post('/login', { email: 'x@example.com', password: 'bad-bad-bad-bad' });
      expect(res.status).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('participant accounts (ADR-P001)', () => {
    const pBody = { name: 'Kofi', email: 'Kofi@Example.com', password: PASSWORD, agreement };
    const pLogin = (portal?: string) =>
      post('/login', {
        email: 'kofi@example.com',
        password: PASSWORD,
        ...(portal ? { portal } : {}),
      });
    async function registerParticipantAndVerify() {
      await post('/register-participant', pBody).expect(202);
      await post('/verify-email', { token: s.mailer.sent[0]!.token }).expect(204);
    }

    it('registers without a business and signs in through the participant portal', async () => {
      await registerParticipantAndVerify();
      const res = await pLogin('participant').expect(200);
      expect(res.body.accountType).toBe('PARTICIPANT');
      expect(res.body.memberships).toEqual([]);
      expect(res.body.activeMembershipId).toBeNull();
      const session = await request(s.app)
        .get('/api/v1/auth/session')
        .set('Cookie', cookieOf(res))
        .expect(200);
      expect(session.body.user.accountType).toBe('PARTICIPANT');
      expect(session.body.active).toBeNull();
    });

    it('requires the agreement and rejects a business name (strict schema)', async () => {
      await post('/register-participant', { ...pBody, agreement: undefined }).expect(400);
      await post('/register-participant', { ...pBody, businessName: 'Acme' }).expect(400);
    });

    it('responds identically for an existing email and sends nothing more', async () => {
      await post('/register-participant', pBody).expect(202);
      const again = await post('/register-participant', pBody).expect(202);
      expect(again.body).toEqual({ status: 'verification_sent' });
      expect(s.mailer.sent).toHaveLength(1);
    });

    it('rejects weak passwords with 422', async () => {
      const res = await post('/register-participant', { ...pBody, password: 'short' });
      expect(res.status).toBe(422);
    });

    it('refuses a participant on the business portal, and a business owner on the participant portal', async () => {
      await registerParticipantAndVerify();
      const wrong = await pLogin('business');
      expect(wrong.status).toBe(409);
      expect(wrong.body.error.code).toBe('WRONG_PORTAL');
      expect(wrong.headers['set-cookie']).toBeUndefined();
      // Omitting the portal means the business portal.
      expect((await pLogin()).body.error.code).toBe('WRONG_PORTAL');

      s = setup();
      await registerAndVerify();
      const res = await post('/login', {
        email: 'ada@example.com',
        password: PASSWORD,
        portal: 'participant',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('WRONG_PORTAL');
    });

    it('does not reveal accounts: a wrong password is a generic 401 on either portal', async () => {
      await registerParticipantAndVerify();
      const res = await post('/login', {
        email: 'kofi@example.com',
        password: 'wrong-wrong-wrong',
        portal: 'business',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('sessions', () => {
    it('GET /session needs a valid cookie', async () => {
      await request(s.app).get('/api/v1/auth/session').expect(401);
      await request(s.app)
        .get('/api/v1/auth/session')
        .set('Cookie', '__Host-sid=garbage')
        .expect(401);
    });

    it('returns the user, active tenant derived from the membership, and the csrf token', async () => {
      await registerAndVerify();
      const { cookie, csrf } = await login();
      const res = await request(s.app)
        .get('/api/v1/auth/session')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.user).toEqual({
        name: 'Ada',
        email: 'ada@example.com',
        emailVerified: true,
        accountType: 'BUSINESS',
      });
      expect(res.body.active.role).toBe('BUSINESS_OWNER');
      expect(res.body.csrfToken).toBe(csrf);
    });

    it('expires after 30 minutes idle, but activity extends it', async () => {
      await registerAndVerify();
      const { cookie } = await login();
      s.advance(SESSION_IDLE_MS - 60_000);
      await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie).expect(200);
      s.advance(SESSION_IDLE_MS - 60_000); // idle is measured from the last touch
      await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie).expect(200);
      s.advance(SESSION_IDLE_MS + 1000);
      await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie).expect(401);
    });

    it('expires at the 12 hour absolute limit regardless of activity', async () => {
      await registerAndVerify();
      const { cookie } = await login();
      for (let elapsed = 0; elapsed < SESSION_ABSOLUTE_MS; elapsed += SESSION_IDLE_MS - 60_000) {
        s.advance(SESSION_IDLE_MS - 60_000);
        const status = (await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie))
          .status;
        if (status === 401) break;
      }
      s.advance(SESSION_IDLE_MS - 60_000);
      await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie).expect(401);
    });

    it('logout revokes the session immediately', async () => {
      await registerAndVerify();
      const { cookie, csrf } = await login();
      await request(s.app)
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrf)
        .expect(204);
      await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie).expect(401);
    });
  });

  describe('CSRF (R-IAM-02)', () => {
    it('rejects state-changing requests without the session-bound token', async () => {
      await registerAndVerify();
      const { cookie } = await login();
      const missing = await request(s.app)
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie);
      expect(missing.status).toBe(403);
      expect(missing.body.error.code).toBe('CSRF_FAILED');
      await request(s.app)
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', 'forged')
        .expect(403);
    });

    it('rejects a foreign Origin and cross-site Sec-Fetch-Site, even on login', async () => {
      await request(s.app)
        .post('/api/v1/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: 'a@b.co', password: 'x' })
        .expect(403);
      await request(s.app)
        .post('/api/v1/auth/login')
        .set('Sec-Fetch-Site', 'cross-site')
        .send({ email: 'a@b.co', password: 'x' })
        .expect(403);
    });

    it("another session's csrf token does not work", async () => {
      await registerAndVerify();
      const a = await login();
      const b = await login();
      expect(a.csrf).not.toBe(b.csrf);
      await request(s.app)
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', a.cookie)
        .set('X-CSRF-Token', b.csrf)
        .expect(403);
    });
  });

  describe('tenant switching (R-TEN-12)', () => {
    it('rotates the cookie and csrf token and revokes the old session', async () => {
      await registerAndVerify();
      const { cookie, csrf, res } = await login();
      const membershipId = res.body.memberships[0].membershipId as string;
      const sw = await request(s.app)
        .post('/api/v1/auth/switch-tenant')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrf)
        .send({ membershipId })
        .expect(200);
      const newCookie = cookieOf(sw);
      expect(newCookie).not.toBe(cookie);
      expect(sw.body.csrfToken).not.toBe(csrf);
      await request(s.app).get('/api/v1/auth/session').set('Cookie', cookie).expect(401);
      await request(s.app).get('/api/v1/auth/session').set('Cookie', newCookie).expect(200);
    });

    it('refuses a membership the user does not hold', async () => {
      await registerAndVerify();
      const { cookie, csrf } = await login();
      await request(s.app)
        .post('/api/v1/auth/switch-tenant')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrf)
        .send({ membershipId: '0197a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' })
        .expect(403);
    });
  });
});

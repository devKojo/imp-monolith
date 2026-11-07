import { Router } from 'express';
import { parse } from '@/shared/http';
import type { AuthService } from '../application/auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerParticipantSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  switchTenantSchema,
  verifyEmailSchema,
} from '../contracts/auth.schemas';
import { OAuthFailedError, UnauthenticatedError, WrongPortalError } from '../domain/errors';
import { authenticate, originCheck, requireCsrfToken, requireSession } from './auth.middleware';
import {
  OAUTH_COOKIE,
  clearedOAuthCookie,
  clearedSessionCookie,
  oauthAttemptCookie,
  parseCookies,
  sessionCookie,
} from './cookies';

/**
 * Handlers only parse (Zod), authorise (declared requirement), call one service method and map
 * the result (R-ARC-08). Every route declares its requirement in the table below.
 */
export function authRouter(auth: AuthService, opts: { allowedOrigins: readonly string[] }): Router {
  const r = Router();
  r.use(originCheck(opts.allowedOrigins));
  r.use(authenticate(auth));
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Declared access per route (R-IAM-06): public = no session required.
  //   POST /register      public       POST /login           public
  //   POST /register-participant  public
  //   POST /verify-email  public       POST /logout          session + csrf
  //   POST /resend-verification  public (rate limited per IP and per address)
  //   GET  /providers     public       POST /send-verification  session + csrf
  //   POST /forgot-password  public (rate limited)   POST /reset-password  public (token)
  //   GET  /session       session      POST /switch-tenant   session + csrf
  //   GET  /google/start  public       GET  /google/callback public
  r.post('/register', async (req, res) => {
    const body = parse(registerSchema, req.body);
    await auth.register({
      name: body.name,
      email: body.email,
      password: body.password,
      businessName: body.businessName,
      agreementVersion: body.agreement.version,
      ip: req.ip ?? 'unknown',
    });
    // Same response whether or not the address was already registered.
    res.status(202).json({ status: 'verification_sent' });
  });

  r.post('/register-participant', async (req, res) => {
    const body = parse(registerParticipantSchema, req.body);
    await auth.registerParticipant({
      name: body.name,
      email: body.email,
      password: body.password,
      agreementVersion: body.agreement.version,
      ip: req.ip ?? 'unknown',
    });
    // Participants are not asked to verify before signing in (they can later, from their account).
    res.status(202).json({ status: 'created' });
  });

  r.post('/verify-email', async (req, res) => {
    await auth.verifyEmail(parse(verifyEmailSchema, req.body).token);
    res.status(204).end();
  });

  r.post('/resend-verification', async (req, res) => {
    const body = parse(resendVerificationSchema, req.body);
    await auth.resendVerification({ email: body.email, ip: req.ip ?? 'unknown' });
    // Same response for unknown, verified and unverified addresses.
    res.status(202).json({ status: 'verification_sent' });
  });

  r.post('/forgot-password', async (req, res) => {
    const body = parse(forgotPasswordSchema, req.body);
    await auth.forgotPassword({ email: body.email, ip: req.ip ?? 'unknown' });
    // Same response whether or not the address has an account.
    res.status(202).json({ status: 'reset_sent' });
  });

  r.post('/reset-password', async (req, res) => {
    const body = parse(resetPasswordSchema, req.body);
    const { accountType } = await auth.resetPassword({
      token: body.token,
      password: body.password,
      ip: req.ip ?? 'unknown',
    });
    // The person proved they own the address, so naming their portal discloses nothing new.
    res.json({ accountType });
  });

  // Which optional sign-in methods this deployment offers (public, no per-user data).
  r.get('/providers', (_req, res) => {
    res.json({ google: auth.googleEnabled });
  });

  r.post('/send-verification', requireSession, requireCsrfToken, async (req, res) => {
    const out = await auth.sendOwnVerification(req.auth!, req.ip ?? 'unknown');
    res.status(out.status === 'sent' ? 202 : 200).json(out);
  });

  r.post('/login', async (req, res) => {
    const body = parse(loginSchema, req.body);
    const { session, memberships, accountType } = await auth.login({
      ...body,
      ip: req.ip ?? 'unknown',
    });
    res.append('Set-Cookie', sessionCookie(session.token, session.expiresAt));
    res.json({
      csrfToken: session.csrfToken,
      accountType,
      memberships,
      activeMembershipId: memberships[0]?.membershipId ?? null,
    });
  });

  // Sign in with Google (participants). Both routes are browser navigations (GET): the signed
  // attempt cookie plus the `state` parameter protect the callback, not the Origin header.
  r.get('/google/start', (_req, res) => {
    if (!auth.googleEnabled) return void res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const { redirectUrl, attemptCookie } = auth.beginGoogle();
    res.append('Set-Cookie', oauthAttemptCookie(attemptCookie));
    res.redirect(302, redirectUrl);
  });

  r.get('/google/callback', async (req, res) => {
    res.append('Set-Cookie', clearedOAuthCookie());
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    try {
      if (!code || req.query.error) throw new OAuthFailedError();
      const { session } = await auth.finishGoogle({
        code,
        state,
        attemptCookie: parseCookies(req.headers.cookie)[OAUTH_COOKIE],
        ip: req.ip ?? 'unknown',
      });
      res.append('Set-Cookie', sessionCookie(session.token, session.expiresAt));
      res.redirect(302, '/me');
    } catch (err) {
      // Same-site relative redirect; the sign-in page shows a generic message.
      res.redirect(
        302,
        `/signin?error=${err instanceof WrongPortalError ? 'google_business' : 'google'}`,
      );
    }
  });

  r.post('/logout', requireSession, requireCsrfToken, async (req, res) => {
    await auth.logout(req.auth!);
    res.append('Set-Cookie', clearedSessionCookie());
    res.status(204).end();
  });

  r.get('/session', requireSession, async (req, res) => {
    const ctx = req.auth!;
    const { memberships } = await auth.profile(ctx);
    res.json({
      user: {
        name: ctx.name,
        email: ctx.email,
        emailVerified: ctx.emailVerified,
        accountType: ctx.accountType,
      },
      active: ctx.active,
      memberships,
      csrfToken: ctx.csrfToken,
    });
  });

  r.post('/switch-tenant', requireSession, requireCsrfToken, async (req, res) => {
    const { membershipId } = parse(switchTenantSchema, req.body);
    if (!req.sessionToken) throw new UnauthenticatedError();
    const session = await auth.switchTenant(req.sessionToken, membershipId);
    res.append('Set-Cookie', sessionCookie(session.token, session.expiresAt));
    res.json({ csrfToken: session.csrfToken, activeMembershipId: membershipId });
  });

  return r;
}

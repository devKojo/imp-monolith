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
import { UnauthenticatedError } from '../domain/errors';
import { authenticate, originCheck, requireCsrfToken, requireSession } from './auth.middleware';
import { clearedSessionCookie, sessionCookie } from './cookies';

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
  //   POST /send-verification  session + csrf
  //   POST /forgot-password  public (rate limited)   POST /reset-password  public (token)
  //   GET  /session       session      POST /switch-tenant   session + csrf
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
    // An already registered address is rejected with 409 EMAIL_TAKEN by the service.
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

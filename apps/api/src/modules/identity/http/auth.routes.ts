import { Router } from 'express';
import { parse } from '@/shared/http';
import type { AuthService } from '../application/auth.service';
import {
  loginSchema,
  registerSchema,
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
  //   POST /verify-email  public       POST /logout          session + csrf
  //   GET  /session       session      POST /switch-tenant   session + csrf
  r.post('/register', async (req, res) => {
    const body = parse(registerSchema, req.body);
    await auth.register({ ...body, ip: req.ip ?? 'unknown' });
    // Same response whether or not the address was already registered.
    res.status(202).json({ status: 'verification_sent' });
  });

  r.post('/verify-email', async (req, res) => {
    await auth.verifyEmail(parse(verifyEmailSchema, req.body).token);
    res.status(204).end();
  });

  r.post('/login', async (req, res) => {
    const body = parse(loginSchema, req.body);
    const { session, memberships } = await auth.login({ ...body, ip: req.ip ?? 'unknown' });
    res.append('Set-Cookie', sessionCookie(session.token, session.expiresAt));
    res.json({
      csrfToken: session.csrfToken,
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
      user: { name: ctx.name, email: ctx.email, emailVerified: ctx.emailVerified },
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

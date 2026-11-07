import type { Request, RequestHandler } from 'express';
import type { AuthContext, AuthService } from '../application/auth.service';
import { CsrfError, UnauthenticatedError } from '../domain/errors';
import { safeEqual } from '../domain/tokens';
import { parseCookies, SESSION_COOKIE } from './cookies';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `authenticate` when a valid session cookie is present. */
    auth?: AuthContext;
    /** The raw session token from the cookie (needed to rotate the session). */
    sessionToken?: string;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Resolves the __Host-sid cookie into `req.auth` (if valid). Never rejects by itself. */
export const authenticate =
  (auth: AuthService): RequestHandler =>
  async (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      const ctx = await auth.authenticate(token);
      if (ctx) {
        req.auth = ctx;
        req.sessionToken = token;
      }
    }
    next();
  };

export const requireSession: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new UnauthenticatedError();
  next();
};

/**
 * Origin and Sec-Fetch-Site validation for every state-changing request (R-IAM-02). Browsers
 * always send at least one of these on cross-site writes; non-browser clients send neither and
 * are covered by the session-bound token below.
 */
export const originCheck =
  (allowedOrigins: readonly string[]): RequestHandler =>
  (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      throw new CsrfError('Origin not allowed');
    }
    const site = req.headers['sec-fetch-site'];
    if (site !== undefined && !['same-origin', 'same-site', 'none'].includes(String(site))) {
      throw new CsrfError('Cross-site request blocked');
    }
    next();
  };

/** Requires the session-bound X-CSRF-Token on authenticated state-changing requests. */
export const requireCsrfToken: RequestHandler = (req: Request, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.auth) throw new UnauthenticatedError();
  const sent = req.headers['x-csrf-token'];
  if (typeof sent !== 'string' || !safeEqual(sent, req.auth.csrfToken)) {
    throw new CsrfError('Missing or invalid CSRF token');
  }
  next();
};

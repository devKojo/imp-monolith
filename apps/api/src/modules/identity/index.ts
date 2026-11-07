// Public surface of the identity module. Other modules import ONLY from here.
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma/client';
import { AuthService, type AuthContext } from './application/auth.service';
import type { GoogleIdentityProvider, Mailer } from './application/ports';
import { authRouter } from './http/auth.routes';
import { Argon2Hasher } from './infrastructure/argon2-hasher';
import { ConsoleMailer } from './infrastructure/console-mailer';
import { HibpBreachChecker } from './infrastructure/hibp-breach-checker';
import { MemoryRateLimiter } from './infrastructure/memory-rate-limiter';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository';

export { GoogleOAuth } from './infrastructure/google-oauth';
export { SmtpMailer } from './infrastructure/smtp-mailer';
export type { AuthContext } from './application/auth.service';
export type { Role } from './application/ports';
export { requireSession, requireCsrfToken } from './http/auth.middleware';

export type IdentityConfig = {
  /** app_runtime client; every query is scoped through withIdentity/withTenant. */
  db: PrismaClient;
  /** Exact origins allowed to make state-changing requests (R-IAM-02). */
  allowedOrigins: readonly string[];
  /** HMAC key for CSRF tokens. If absent a per-process key is used (tokens refetched on restart). */
  sessionSecret?: string | undefined;
  mailer?: Mailer;
  /** Enables Sign in with Google for participants when present. */
  google?: GoogleIdentityProvider;
};

export function createIdentityModule(cfg: IdentityConfig) {
  const auth = new AuthService({
    repo: new PrismaIdentityRepository(cfg.db),
    hasher: new Argon2Hasher(),
    breached: new HibpBreachChecker(),
    mailer: cfg.mailer ?? new ConsoleMailer(),
    google: cfg.google,
    loginLimiter: new MemoryRateLimiter(20, 15 * 60 * 1000), // failures per IP / 15 min
    registerLimiter: new MemoryRateLimiter(10, 60 * 60 * 1000), // attempts per IP / hour
    resendIpLimiter: new MemoryRateLimiter(10, 60 * 60 * 1000), // resends per IP / hour
    resendEmailLimiter: new MemoryRateLimiter(5, 60 * 60 * 1000), // resends per address / hour
    resendCooldown: new MemoryRateLimiter(1, 60 * 1000), // one resend per address / minute
    csrfSecret: cfg.sessionSecret ?? randomBytes(32).toString('hex'),
  });
  return {
    basePath: '/api/v1/auth',
    router: authRouter(auth, { allowedOrigins: cfg.allowedOrigins }),
    auth,
  };
}

export type IdentityModule = ReturnType<typeof createIdentityModule>;
export type { AuthService };
export type CurrentUser = AuthContext;

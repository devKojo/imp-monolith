import type { PrismaClient } from '@/generated/prisma/client';
import { isUuid } from '@/shared/uuid';
import { runScoped, type TenantTx, type WithTenantOptions } from './with-tenant';

/**
 * Identity scope for rows that belong to a person rather than a tenant (users, sessions, email
 * verifications, own memberships). RLS policies read these transaction-local settings, so an
 * unscoped query sees nothing. Use only from the identity module.
 */
export type IdentityScope = {
  /** The authenticated (or just-registered) user. */
  userId?: string;
  /** Email being logged in; lets the login flow find the row before the user id is known. */
  loginEmail?: string;
  /** SHA-256 hex of the session token being looked up. */
  sessionTokenHash?: string;
  /** SHA-256 hex of an email-verification token being redeemed. */
  verificationTokenHash?: string;
  /** SHA-256 hex of a password-reset token being redeemed. */
  resetTokenHash?: string;
  /** Registration only: creates the business and first membership in the same transaction. */
  tenantId?: string;
};

export function withIdentity<T>(
  db: PrismaClient,
  scope: IdentityScope,
  fn: (tx: TenantTx) => Promise<T>,
  opts: WithTenantOptions = {},
): Promise<T> {
  if (scope.userId !== undefined && !isUuid(scope.userId))
    throw new TypeError('userId must be a UUID');
  if (scope.tenantId !== undefined && !isUuid(scope.tenantId)) {
    throw new TypeError('tenantId must be a UUID');
  }
  const settings: Array<[string, string]> = [];
  if (scope.userId) settings.push(['app.user_id', scope.userId]);
  if (scope.loginEmail) settings.push(['app.login_email', scope.loginEmail]);
  if (scope.sessionTokenHash) settings.push(['app.session_hash', scope.sessionTokenHash]);
  if (scope.verificationTokenHash) {
    settings.push(['app.verification_hash', scope.verificationTokenHash]);
  }
  if (scope.resetTokenHash) settings.push(['app.reset_hash', scope.resetTokenHash]);
  if (scope.tenantId) settings.push(['app.tenant_id', scope.tenantId]);
  return runScoped(db, settings, fn, opts);
}

/**
 * Narrow the scope inside a running identity transaction once the user is known, e.g. after a
 * session or verification token lookup resolved the owning user.
 */
export async function setIdentityUser(tx: TenantTx, userId: string): Promise<void> {
  if (!isUuid(userId)) throw new TypeError('userId must be a UUID');
  await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
}

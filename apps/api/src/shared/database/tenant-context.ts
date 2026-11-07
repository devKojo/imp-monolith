import { isUuid } from '@/shared/uuid';

declare const tenantContextBrand: unique symbol;

/**
 * Proof that a tenant has been resolved server-side (R-TEN-04). Create it only in authentication
 * middleware or in an event consumer from `envelope.tenantId`; never from client-supplied input.
 */
export type TenantContext = Readonly<{
  tenantId: string;
  actorId?: string;
  requestId: string;
  [tenantContextBrand]: true;
}>;

export function createTenantContext(input: {
  tenantId: string;
  actorId?: string;
  requestId: string;
}): TenantContext {
  if (!isUuid(input.tenantId)) throw new TypeError('tenantId must be a UUID');
  if (input.actorId !== undefined && !isUuid(input.actorId)) {
    throw new TypeError('actorId must be a UUID');
  }
  return Object.freeze({ ...input }) as TenantContext;
}

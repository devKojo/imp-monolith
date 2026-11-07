import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

export type DbClientOptions = {
  connectionString: string;
  /** pg pool size; sum of replicas x this must stay under 70% of the pooler limit (R-DAT-05). */
  poolMax: number;
};

function createClient({ connectionString, poolMax }: DbClientOptions): PrismaClient {
  // With driver adapters the pool is configured on pg, not via the URL's connection_limit.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: poolMax }) });
}

/**
 * Three role-separated clients plus an optional read client (R-TEN-03). They are created by a
 * composition root and passed in; there are no module-level singletons.
 *
 * - tenantDb   app_runtime  RLS applies; use only through withTenant()
 * - systemDb   app_system   infrastructure tables only (outbox publisher, scheduler)
 * - platformDb app_platform BYPASSRLS; modules/administration only
 * - readDb     replica      reports and aggregates (R-DAT-13)
 */
export const createTenantDb = (o: DbClientOptions) => createClient(o);
export const createSystemDb = (o: DbClientOptions) => createClient(o);
export const createPlatformDb = (o: DbClientOptions) => createClient(o);
export const createReadDb = (o: DbClientOptions) => createClient(o);

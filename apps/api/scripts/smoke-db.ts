/**
 * Smoke test: verifies the API can reach Postgres through Prisma as the runtime role.
 * Run with `npm run smoke:db -w @imp/api` (needs DATABASE_URL and a running database).
 * Under app_runtime without a tenant, RLS returns zero rows (fail closed), which is expected.
 */
import { config } from 'dotenv';
import { createTenantDb } from '../src/shared/database/clients';

config({ path: ['.env', '../../.env'], quiet: true }); // app-local .env wins over repo-root .env
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('FAIL: DATABASE_URL is not set');
  process.exit(1);
}

const db = createTenantDb({ connectionString: url, poolMax: 2 });

try {
  const [time] = await db.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
  console.warn(`OK: connected to Postgres (server time ${time?.now.toISOString()})`);
  const [who] = await db.$queryRaw<{ role: string; bypass: boolean }[]>`
    SELECT current_user AS role, rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user`;
  console.warn(`OK: connected as ${who?.role} (BYPASSRLS: ${who?.bypass})`);
  const rows = await db.business.count();
  console.warn(`OK: schema applied (businesses visible without tenant context: ${rows})`);
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

/**
 * Provision the four database roles (spec R-TEN-02). Idempotent; run once per database.
 *
 *   app_migrator  owns schema objects, DDL only; used for `prisma migrate deploy`
 *   app_runtime   NOBYPASSRLS, DML on tenant tables (tenantDb)
 *   app_system    NOBYPASSRLS, infrastructure tables only (systemDb)
 *   app_platform  BYPASSRLS, Administration module only (platformDb)
 *
 * Env: PROVISION_DATABASE_URL (a role allowed to CREATE ROLE), and one password per role:
 * APP_MIGRATOR_PASSWORD, APP_RUNTIME_PASSWORD, APP_SYSTEM_PASSWORD, APP_PLATFORM_PASSWORD.
 * Passwords are never stored in the repository. If the provider forbids BYPASSRLS, this fails on
 * app_platform; report it instead of weakening the other roles.
 */
import { config } from 'dotenv';
import pg from 'pg';

config({ path: ['.env', '../../.env'], quiet: true });

const ROLES = [
  { name: 'app_migrator', passwordVar: 'APP_MIGRATOR_PASSWORD', bypassRls: false },
  { name: 'app_runtime', passwordVar: 'APP_RUNTIME_PASSWORD', bypassRls: false },
  { name: 'app_system', passwordVar: 'APP_SYSTEM_PASSWORD', bypassRls: false },
  { name: 'app_platform', passwordVar: 'APP_PLATFORM_PASSWORD', bypassRls: true },
] as const;

const url = process.env.PROVISION_DATABASE_URL;
if (!url) {
  console.error('FAIL: PROVISION_DATABASE_URL is not set');
  process.exit(1);
}
const missing = ROLES.filter((r) => !process.env[r.passwordVar]).map((r) => r.passwordVar);
if (missing.length > 0) {
  console.error(`FAIL: missing ${missing.join(', ')}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  // Identifiers come from the constant list above; literals are quoted server-side.
  const quote = async (value: string) =>
    (await client.query<{ q: string }>('SELECT quote_literal($1) AS q', [value])).rows[0]!.q;

  for (const role of ROLES) {
    const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role.name]);
    if (exists.rowCount === 0) {
      const password = await quote(process.env[role.passwordVar]!);
      await client.query(
        `CREATE ROLE ${role.name} LOGIN ${role.bypassRls ? 'BYPASSRLS' : 'NOBYPASSRLS'} PASSWORD ${password}`,
      );
      console.warn(`created role ${role.name}`);
    } else {
      console.warn(`role ${role.name} already exists (unchanged)`);
    }
  }

  const { rows: db } = await client.query<{ name: string }>('SELECT current_database() AS name');
  const dbName = `"${db[0]!.name.replace(/"/g, '""')}"`;
  await client.query(
    `GRANT CONNECT ON DATABASE ${dbName} TO app_migrator, app_runtime, app_system, app_platform`,
  );
  await client.query('GRANT USAGE ON SCHEMA public TO app_runtime, app_system, app_platform');
  await client.query('GRANT ALL ON SCHEMA public TO app_migrator');

  // Hand pre-existing objects to the migrator so it can run migrations (first-time setup).
  const { rows: tables } = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  for (const t of tables) {
    await client.query(
      `ALTER TABLE public."${t.tablename.replace(/"/g, '""')}" OWNER TO app_migrator`,
    );
  }
  console.warn('OK: roles provisioned');
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}

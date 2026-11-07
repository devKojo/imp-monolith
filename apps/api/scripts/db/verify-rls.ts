/**
 * R-TEN-01/02, ARC-022: every tenant table has ENABLE + FORCE RLS and a policy; app_runtime and
 * app_system have no BYPASSRLS and own no tables; app_platform is the only BYPASSRLS role.
 * Needs MIGRATE_DATABASE_URL (or DATABASE_URL); reads the catalogue only.
 */
import { config } from 'dotenv';
import pg from 'pg';
import { fail } from './lib/schema';

config({ path: ['.env', '../../.env'], quiet: true });

// Tables that are tenant-scoped without a tenant_id column, or global tables that must still be RLS-protected.
const EXTRA_PROTECTED = ['businesses', 'users'];

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('FAIL: MIGRATE_DATABASE_URL or DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const problems: string[] = [];
try {
  const { rows: tenantTables } = await client.query<{ t: string }>(
    `SELECT DISTINCT table_name AS t FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'tenant_id'`,
  );
  const protectedTables = [...new Set([...tenantTables.map((r) => r.t), ...EXTRA_PROTECTED])];

  for (const t of protectedTables) {
    const { rows } = await client.query<{ rls: boolean; forced: boolean; policies: string }>(
      `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
              (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r', 'p')`,
      [t],
    );
    const r = rows[0];
    if (!r) problems.push(`table ${t} not found`);
    else {
      if (!r.rls) problems.push(`${t}: ROW LEVEL SECURITY is not enabled`);
      if (!r.forced) problems.push(`${t}: ROW LEVEL SECURITY is not FORCED`);
      if (Number(r.policies) === 0) problems.push(`${t}: no RLS policy defined`);
    }
  }

  const { rows: roles } = await client.query<{
    rolname: string;
    rolbypassrls: boolean;
    rolsuper: boolean;
  }>(
    `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles
      WHERE rolname IN ('app_migrator', 'app_runtime', 'app_system', 'app_platform')`,
  );
  for (const name of ['app_migrator', 'app_runtime', 'app_system', 'app_platform']) {
    const role = roles.find((r) => r.rolname === name);
    if (!role) {
      problems.push(`role ${name} does not exist`);
      continue;
    }
    if (role.rolsuper) problems.push(`${name} must not be a superuser`);
    if (name === 'app_platform' ? !role.rolbypassrls : role.rolbypassrls) {
      problems.push(`${name}: BYPASSRLS must be ${name === 'app_platform'}`);
    }
  }

  const { rows: owned } = await client.query<{ tableowner: string; tablename: string }>(
    `SELECT tablename, tableowner FROM pg_tables
      WHERE schemaname = 'public' AND tableowner IN ('app_runtime', 'app_system', 'app_platform')`,
  );
  for (const o of owned)
    problems.push(`${o.tableowner} owns table ${o.tablename} (owners bypass RLS unless forced)`);
} finally {
  await client.end();
}

fail('verify-rls', problems);

/**
 * R-DAT-02: raw-SQL objects Prisma does not track exist and grants are as specified
 * (R-TEN-02, R-SEC-04). Run against a freshly migrated database.
 */
import { config } from 'dotenv';
import pg from 'pg';
import { fail } from './lib/schema';

config({ path: ['.env', '../../.env'], quiet: true });

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('FAIL: MIGRATE_DATABASE_URL or DATABASE_URL is not set');
  process.exit(1);
}

const EXPECTED_INDEXES = [
  'memberships_active_user_key',
  'sessions_token_hash_key',
  'email_verifications_token_hash_key',
  'password_resets_token_hash_key',
  'outbox_pending_idx',
  'outbox_dispatched_idx',
  'templates_tenant_id_id_key',
  'template_fields_tenant_id_template_id_key_key',
  'memberships_tenant_id_id_key',
  'outbox_events_aggregate_id_aggregate_version_key',
];
const EXPECTED_POLICIES: Array<[string, string]> = [
  ['businesses', 'tenant_isolation'],
  ['memberships', 'tenant_isolation'],
  ['users', 'tenant_member_select'],
  ['outbox_events', 'tenant_insert'],
  ['outbox_events', 'system_all'],
  ['audit_log', 'tenant_select'],
  ['audit_log', 'tenant_insert'],
  ['audit_log', 'identity_insert'],
  ['users', 'identity_select'],
  ['users', 'identity_insert'],
  ['users', 'identity_update'],
  ['memberships', 'identity_select'],
  ['businesses', 'identity_member_select'],
  ['sessions', 'session_select'],
  ['sessions', 'session_insert'],
  ['sessions', 'session_update'],
  ['sessions', 'session_delete'],
  ['email_verifications', 'verification_select'],
  ['email_verifications', 'verification_insert'],
  ['email_verifications', 'verification_update'],
  ['password_resets', 'reset_select'],
  ['password_resets', 'reset_insert'],
  ['password_resets', 'reset_update'],
  ['templates', 'tenant_isolation'],
  ['template_fields', 'tenant_isolation'],
];
// [role, table, privilege, expected]
const EXPECTED_GRANTS: Array<[string, string, string, boolean]> = [
  ['app_runtime', 'outbox_events', 'INSERT', true],
  ['app_runtime', 'outbox_events', 'SELECT', false],
  ['app_runtime', 'outbox_events', 'UPDATE', false],
  ['app_system', 'outbox_events', 'SELECT', true],
  ['app_system', 'outbox_events', 'UPDATE', true],
  ['app_system', 'memberships', 'SELECT', false],
  ['app_system', 'businesses', 'SELECT', false],
  ['app_runtime', 'audit_log', 'INSERT', true],
  ['app_runtime', 'audit_log', 'UPDATE', false],
  ['app_runtime', 'audit_log', 'DELETE', false],
  ['app_runtime', 'audit_log', 'TRUNCATE', false],
  ['app_system', 'audit_log', 'INSERT', false],
  ['app_platform', 'audit_log', 'UPDATE', false],
  ['app_platform', 'audit_log', 'DELETE', false],
  ['app_runtime', 'businesses', 'DELETE', false],
  ['app_runtime', 'memberships', 'DELETE', true],
  ['app_runtime', 'sessions', 'DELETE', true],
  ['app_system', 'sessions', 'SELECT', false],
  ['app_system', 'email_verifications', 'SELECT', false],
  ['app_system', 'password_resets', 'SELECT', false],
  ['app_runtime', 'users', 'DELETE', false],
  ['app_runtime', 'templates', 'DELETE', false],
  ['app_runtime', 'templates', 'UPDATE', true],
  ['app_runtime', 'template_fields', 'DELETE', true],
  ['app_system', 'templates', 'SELECT', false],
  ['app_system', 'template_fields', 'SELECT', false],
];

const client = new pg.Client({ connectionString: url });
await client.connect();
const problems: string[] = [];
try {
  const { rows: idx } = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
  );
  for (const name of EXPECTED_INDEXES) {
    if (!idx.some((i) => i.indexname === name)) problems.push(`missing index ${name}`);
  }
  const { rows: pol } = await client.query<{ tablename: string; policyname: string }>(
    "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'",
  );
  for (const [t, p] of EXPECTED_POLICIES) {
    if (!pol.some((r) => r.tablename === t && r.policyname === p))
      problems.push(`missing policy ${p} on ${t}`);
  }
  for (const [role, table, priv, expected] of EXPECTED_GRANTS) {
    const { rows } = await client.query<{ ok: boolean }>(
      'SELECT has_table_privilege($1, $2, $3) AS ok',
      [role, `public.${table}`, priv],
    );
    if (rows[0]?.ok !== expected) {
      problems.push(`${role} ${expected ? 'lacks' : 'must not have'} ${priv} on ${table}`);
    }
  }
} finally {
  await client.end();
}

fail('verify-db-objects', problems);

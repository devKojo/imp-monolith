/**
 * Adds or removes platform staff (people who may review rewards across businesses).
 *
 *   npm run platform:grant-staff -- person@example.com            grant
 *   npm run platform:grant-staff -- person@example.com --revoke   revoke
 *
 * Staff are never added through the app: this is run by an operator with the migration database URL, so
 * becoming staff needs database access, not just an account. The person must already have an account.
 * Prints what it did and never prints a password or token.
 */
import { config } from 'dotenv';
import pg from 'pg';

config({ path: ['.env', '../../.env'], quiet: true });

const [email, flag] = process.argv.slice(2);
const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!email || (flag !== undefined && flag !== '--revoke')) {
  console.error('Usage: platform:grant-staff <email> [--revoke]');
  process.exit(1);
}
if (!url) {
  console.error('FAIL: MIGRATE_DATABASE_URL or DATABASE_URL is not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const found = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = found.rows[0];
  if (!user) {
    console.error('FAIL: no account has that email address');
    process.exit(1);
  }
  if (flag === '--revoke') {
    const r = await client.query(
      'UPDATE platform_staff SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [user.id],
    );
    console.log(
      r.rowCount ? 'Revoked platform access.' : 'That person was not active platform staff.',
    );
  } else {
    await client.query(
      `INSERT INTO platform_staff (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET revoked_at = NULL, granted_at = now()`,
      [user.id],
    );
    console.log('Granted platform access.');
  }
} finally {
  await client.end();
}

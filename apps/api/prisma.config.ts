import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env', '../../.env'], quiet: true }); // app-local .env wins over repo-root .env

// Migrations run as app_migrator (owner, DDL only) when MIGRATE_DATABASE_URL is set (R-TEN-02,
// R-DAT-04). Falls back to DATABASE_URL so existing local setups keep working until roles exist.
const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` needs no connection, so tolerate a missing URL there.
  datasource: { url: url ?? 'postgresql://invalid:invalid@localhost:5432/invalid' },
});

/**
 * Every `id` and id-reference column is a UUID. Static check of schema.prisma always; with --db
 * also checks information_schema.columns of the live database.
 * `outbox_events.seq` is an ordering sequence, not an identifier, and is allow-listed.
 */
import { config } from 'dotenv';
import pg from 'pg';
import { fail, parseModels } from './lib/schema';

config({ path: ['.env', '../../.env'], quiet: true });

const ALLOWED_NON_UUID = new Set(['outbox_events.seq']);
const isIdName = (name: string) => name === 'id' || /Id$/.test(name);
const problems: string[] = [];

for (const model of parseModels()) {
  const table = /@@map\("([^"]+)"\)/.exec(model.blockAttrs.join(' '))?.[1] ?? model.name;
  for (const f of model.fields) {
    if (f.attrs.includes('@relation')) continue; // relation fields are not columns
    const isId = f.attrs.includes('@id');
    if (!isId && !isIdName(f.name)) continue;
    if (ALLOWED_NON_UUID.has(`${table}.${f.name}`)) continue;
    const where = `${model.name}.${f.name}`;
    if (!f.attrs.includes('@db.Uuid')) problems.push(`${where} must be @db.Uuid`);
    if (f.type.replace('?', '') !== 'String') problems.push(`${where} must be String`);
    if (f.name === 'id' && isId && !f.attrs.includes('@default(uuid(7))')) {
      problems.push(`${where} must default to uuid(7)`);
    }
  }
}

if (process.argv.includes('--db')) {
  const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    problems.push('--db requires MIGRATE_DATABASE_URL or DATABASE_URL');
  } else {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ t: string; c: string; type: string }>(
        `SELECT table_name AS t, column_name AS c, data_type AS type
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
            AND (column_name = 'id' OR column_name LIKE '%\\_id')`,
      );
      for (const r of rows) {
        if (r.type !== 'uuid' && !ALLOWED_NON_UUID.has(`${r.t}.${r.c}`)) {
          problems.push(`${r.t}.${r.c} is ${r.type}, expected uuid`);
        }
      }
    } finally {
      await client.end();
    }
  }
}

fail('check-uuid', problems);

/**
 * Backfill "as people pass" awards for people who qualified before the prizes existed (or before awarding
 * on completion shipped). It reuses `allocateOnCompletion`, so every rule is the live one: first come first
 * served in the order people finished, one award per person, risk scoring, locked per campaign, and the
 * 14-day claim window starting now. Safe to re-run: anyone who already has an award is skipped, and a recalled
 * award keeps its person marked as awarded.
 *
 *   npm run db:backfill-instant-awards -w @imp/api             dry run: allocates, then rolls back
 *   npm run db:backfill-instant-awards -w @imp/api -- --apply  writes the awards
 *   ... -- --campaign <uuid>                                  limit to one campaign
 *
 * Env: PLATFORM_DATABASE_URL (app_platform, BYPASSRLS; read-only, finds who qualified across businesses) and
 * DATABASE_URL (app_runtime; every write goes through withTenant, so RLS applies). Never commit either.
 */
import { config } from 'dotenv';
import pg from 'pg';
import { allocateOnCompletion } from '../../src/modules/rewards/infrastructure/instant-awards';
import { createTenantDb, createTenantContext, withTenant } from '../../src/shared/database';

config({ path: ['.env', '../../.env'], quiet: true });

const apply = process.argv.includes('--apply');
const only = process.argv[process.argv.indexOf('--campaign') + 1];
const campaignFilter = process.argv.includes('--campaign') ? only : undefined;

const platformUrl = process.env.PLATFORM_DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!platformUrl || !runtimeUrl) {
  console.error('FAIL: PLATFORM_DATABASE_URL and DATABASE_URL must both be set');
  process.exit(1);
}

type Candidate = {
  tenant_id: string;
  campaign_id: string;
  archetype: 'QUIZ' | 'SURVEY';
  user_id: string;
  finished_at: Date;
};

/** Everyone who qualified in a campaign whose prizes all go to the first to qualify, and has no award yet. */
const FIND = `
  WITH instant AS (
    SELECT c.id AS campaign_id, c.tenant_id, t.archetype::text AS archetype
    FROM campaigns c
    JOIN campaign_templates t ON t.id = c.template_id
    WHERE c.deleted_at IS NULL
      AND c.status IN ('LIVE', 'PAUSED', 'COMPLETED')
      AND t.archetype::text IN ('QUIZ', 'SURVEY')
      AND EXISTS (SELECT 1 FROM campaign_prizes p WHERE p.campaign_id = c.id)
      AND NOT EXISTS (
        SELECT 1 FROM campaign_prizes p
        WHERE p.campaign_id = c.id AND p.selection IS DISTINCT FROM 'COMPLETION')
      AND ($1::uuid IS NULL OR c.id = $1::uuid)
  ), done AS (
    SELECT a.tenant_id, a.campaign_id, a.user_id, MIN(a.submitted_at) AS finished_at
    FROM quiz_attempts a WHERE a.passed IS TRUE AND a.submitted_at IS NOT NULL
    GROUP BY 1, 2, 3
    UNION ALL
    SELECT r.tenant_id, r.campaign_id, r.user_id, r.submitted_at
    FROM survey_responses r WHERE r.submitted_at IS NOT NULL
  )
  SELECT i.tenant_id, i.campaign_id, i.archetype, d.user_id, d.finished_at
  FROM instant i
  JOIN done d ON d.campaign_id = i.campaign_id AND d.tenant_id = i.tenant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM reward_awards w WHERE w.campaign_id = i.campaign_id AND w.user_id = d.user_id)
  ORDER BY i.campaign_id, d.finished_at, d.user_id`;

class DryRun extends Error {}

const platform = new pg.Pool({ connectionString: platformUrl, max: 1 });
const db = createTenantDb({ connectionString: runtimeUrl, poolMax: 2 });

try {
  const { rows } = await platform.query<Candidate>(FIND, [campaignFilter ?? null]);
  console.warn(`${apply ? 'APPLY' : 'DRY RUN'}: ${rows.length} people qualified without an award`);

  const tally = { awarded: 0, held: 0, none: 0 };
  for (const row of rows) {
    const ctx = createTenantContext({
      tenantId: row.tenant_id,
      requestId: 'backfill-instant-awards',
    });
    let outcome: Awaited<ReturnType<typeof allocateOnCompletion>> = null;
    try {
      await withTenant(db, ctx, async (tx) => {
        outcome = await allocateOnCompletion(tx, {
          tenantId: row.tenant_id,
          campaignId: row.campaign_id,
          userId: row.user_id,
          archetype: row.archetype,
          now: new Date(),
        });
        if (!apply) throw new DryRun();
      });
    } catch (e) {
      if (!(e instanceof DryRun)) throw e;
    }
    const result = outcome as Awaited<ReturnType<typeof allocateOnCompletion>>;
    if (!result) tally.none++;
    else if (result.status === 'PENDING_REVIEW') tally.held++;
    else tally.awarded++;
  }
  console.warn(
    `${apply ? 'Created' : 'Would create'}: ${tally.awarded} available, ${tally.held} held for review; ` +
      `${tally.none} got nothing (every tier already taken)`,
  );
} catch (err) {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await platform.end();
  await db.$disconnect();
}

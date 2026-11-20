-- Rewards foundation (ADR-R001, part 1): machine-readable prizes, awards, an event trail, a points ledger,
-- reproducible draws, and the risk signals captured when a participant takes part.
--
-- Additive only. Every new table is tenant-scoped with forced row-level security and composite FKs
-- (R-TEN-01, R-TEN-05). Events, ledger entries, draws and signals are insert-only for the runtime role.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "PrizeKind" AS ENUM ('CASH', 'POINTS', 'ITEM');
CREATE TYPE "PrizeSelection" AS ENUM ('RANKING', 'DRAW', 'POOL', 'INSTANT', 'COMPLETION');
CREATE TYPE "AwardStatus" AS ENUM ('PENDING_REVIEW', 'AVAILABLE', 'CLAIMED', 'FULFILLED', 'HELD', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "SignalKind" AS ENUM ('JOIN', 'CLAIM');

-- ---------------------------------------------------------------------------
-- Prizes become machine-readable. Existing rows are ITEM prizes and keep their text.
-- ---------------------------------------------------------------------------

ALTER TABLE "campaign_prizes"
  ADD COLUMN "kind" "PrizeKind" NOT NULL DEFAULT 'ITEM',
  ADD COLUMN "amount_minor" BIGINT,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "rank_from" INTEGER,
  ADD COLUMN "rank_to" INTEGER,
  ADD COLUMN "selection" "PrizeSelection";

ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_amount_nonneg" CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0);
ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_rank_valid"
  CHECK (("rank_from" IS NULL AND "rank_to" IS NULL) OR ("rank_from" >= 1 AND "rank_to" >= "rank_from"));
ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_cash_has_currency"
  CHECK ("kind" <> 'CASH' OR "amount_minor" IS NULL OR "currency" IS NOT NULL);
CREATE UNIQUE INDEX "campaign_prizes_tenant_id_id_key" ON "campaign_prizes"("tenant_id", "id");

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per winning slot. "prize_id" is null for an equal share of a prize pool. The amount is a snapshot.
CREATE TABLE "reward_awards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "prize_id" UUID,
    "user_id" UUID NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "rank" INTEGER,
    "kind" "PrizeKind" NOT NULL,
    "amount_minor" BIGINT,
    "currency" TEXT,
    "source" "PrizeSelection" NOT NULL,
    "status" "AwardStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "claim_by" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_awards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reward_awards_amount_nonneg" CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0),
    CONSTRAINT "reward_awards_risk_range" CHECK ("risk_score" BETWEEN 0 AND 100)
);

-- Append-only timeline of an award: who did what, and why.
CREATE TABLE "reward_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "award_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" TEXT NOT NULL,
    "from_status" "AwardStatus",
    "to_status" "AwardStatus",
    "reason_code" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_events_pkey" PRIMARY KEY ("id")
);

-- Append-only points. The balance is the sum of "delta"; the idempotency key makes a replay a no-op.
CREATE TABLE "points_ledger" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "award_id" UUID,
    "delta" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "points_ledger_delta_nonzero" CHECK ("delta" <> 0)
);

-- A reproducible draw: everything needed to re-run it and get the same winners. One per campaign.
CREATE TABLE "reward_draws" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "rules_hash" TEXT NOT NULL,
    "sealed_at" TIMESTAMPTZ NOT NULL,
    "entrants_hash" TEXT,
    "entrant_count" INTEGER,
    "entropy" TEXT,
    "seed" TEXT,
    "winners" JSONB NOT NULL DEFAULT '[]',
    "drawn_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_draws_pkey" PRIMARY KEY ("id")
);

-- Facts about a participation for abuse detection. Hashes only (HMAC with a server secret): never the raw
-- IP or user agent.
CREATE TABLE "participation_signals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "SignalKind" NOT NULL,
    "ip_hash" TEXT,
    "ua_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participation_signals_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes. The partial unique ones make a duplicate award impossible, not just unlikely.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "reward_awards_tenant_id_id_key" ON "reward_awards"("tenant_id", "id");
CREATE UNIQUE INDEX "reward_awards_slot_key" ON "reward_awards"("tenant_id", "campaign_id", "prize_id", "slot") WHERE "prize_id" IS NOT NULL;
CREATE UNIQUE INDEX "reward_awards_prize_user_key" ON "reward_awards"("tenant_id", "campaign_id", "prize_id", "user_id") WHERE "prize_id" IS NOT NULL;
CREATE UNIQUE INDEX "reward_awards_pool_user_key" ON "reward_awards"("tenant_id", "campaign_id", "user_id") WHERE "prize_id" IS NULL;
CREATE INDEX "reward_awards_tenant_id_campaign_id_status_idx" ON "reward_awards"("tenant_id", "campaign_id", "status");
CREATE INDEX "reward_awards_tenant_id_user_id_idx" ON "reward_awards"("tenant_id", "user_id");
CREATE INDEX "reward_events_tenant_id_award_id_created_at_idx" ON "reward_events"("tenant_id", "award_id", "created_at");
CREATE UNIQUE INDEX "points_ledger_tenant_id_idempotency_key_key" ON "points_ledger"("tenant_id", "idempotency_key");
CREATE INDEX "points_ledger_tenant_id_user_id_idx" ON "points_ledger"("tenant_id", "user_id");
CREATE UNIQUE INDEX "reward_draws_tenant_id_campaign_id_key" ON "reward_draws"("tenant_id", "campaign_id");
CREATE INDEX "participation_signals_tenant_id_campaign_id_ip_hash_idx" ON "participation_signals"("tenant_id", "campaign_id", "ip_hash");
CREATE INDEX "participation_signals_tenant_id_user_id_idx" ON "participation_signals"("tenant_id", "user_id");
CREATE INDEX "participation_signals_created_at_idx" ON "participation_signals"("created_at");

-- ---------------------------------------------------------------------------
-- Foreign keys (composite: a row can only point at a parent of its own business)
-- ---------------------------------------------------------------------------

ALTER TABLE "reward_awards" ADD CONSTRAINT "reward_awards_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reward_awards" ADD CONSTRAINT "reward_awards_tenant_id_prize_id_fkey" FOREIGN KEY ("tenant_id", "prize_id") REFERENCES "campaign_prizes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reward_awards" ADD CONSTRAINT "reward_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reward_events" ADD CONSTRAINT "reward_events_tenant_id_award_id_fkey" FOREIGN KEY ("tenant_id", "award_id") REFERENCES "reward_awards"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_tenant_id_award_id_fkey" FOREIGN KEY ("tenant_id", "award_id") REFERENCES "reward_awards"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reward_draws" ADD CONSTRAINT "reward_draws_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participation_signals" ADD CONSTRAINT "participation_signals_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participation_signals" ADD CONSTRAINT "participation_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row-level security: the same fail-closed policy as every tenant table.
-- ---------------------------------------------------------------------------

ALTER TABLE "reward_awards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reward_awards" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reward_awards" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "reward_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reward_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reward_events" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "points_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "points_ledger" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "points_ledger" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "reward_draws" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reward_draws" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reward_draws" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "participation_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "participation_signals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "participation_signals" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants. Awards can change state; the trail, the ledger, draws and signals are insert-only for the runtime.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON "reward_awards" TO app_runtime;
GRANT SELECT, INSERT ON "reward_events", "points_ledger", "reward_draws", "participation_signals" TO app_runtime;
-- A draw is sealed first and completed once, so the runtime may update only that table's draw columns.
GRANT UPDATE ("entrants_hash", "entrant_count", "entropy", "seed", "winners", "drawn_at") ON "reward_draws" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "reward_awards", "reward_events", "points_ledger", "reward_draws", "participation_signals" TO app_platform;

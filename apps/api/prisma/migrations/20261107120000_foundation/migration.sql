-- Foundation: tenancy, outbox/inbox, audit log, forced RLS, role grants.
-- Requires the roles from scripts/db/provision-roles.sql to exist (fails fast otherwise).
-- Pre-release: replaces the placeholder users table (0 rows) rather than expand/contract.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_system')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform') THEN
    RAISE EXCEPTION 'Roles app_runtime, app_system and app_platform must exist. Run scripts/db/provision-roles.sql first.';
  END IF;
END
$$;

DROP TABLE IF EXISTS "users";

-- ---------------------------------------------------------------------------
-- Tables (baseline from schema.prisma)
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('BUSINESS_OWNER', 'BUSINESS_ADMINISTRATOR', 'CAMPAIGN_MANAGER', 'CAMPAIGN_OPERATOR', 'ANALYST', 'MODERATOR');

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "seq" BIGSERIAL NOT NULL,
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "partition" SMALLINT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "quarantined_at" TIMESTAMPTZ,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("consumer","event_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_id_key" ON "outbox_events"("id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_aggregate_id_aggregate_version_key" ON "outbox_events"("aggregate_id", "aggregate_version");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_created_at_idx" ON "audit_log"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw-SQL objects Prisma does not model (R-STK-05, R-DAT-02)
-- ---------------------------------------------------------------------------

-- One active membership per (tenant, user); soft-deleted rows excluded (R-DAT-09).
CREATE UNIQUE INDEX "memberships_active_user_key"
  ON "memberships" ("tenant_id", "user_id") WHERE "deleted_at" IS NULL;

-- Pending outbox rows, per partition, in order (R-EVT-02).
CREATE INDEX "outbox_pending_idx"
  ON "outbox_events" ("partition", "seq")
  WHERE "dispatched_at" IS NULL AND "quarantined_at" IS NULL;

-- Prune support for dispatched rows (R-EVT-04).
CREATE INDEX "outbox_dispatched_idx"
  ON "outbox_events" ("dispatched_at") WHERE "dispatched_at" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row-level security (R-TEN-01). nullif() makes an empty-string setting (left behind after a
-- transaction-local set_config on a pooled connection) evaluate to NULL, so the policy fails
-- closed (zero rows) instead of raising an invalid-uuid error.
-- ---------------------------------------------------------------------------

ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "businesses" TO app_runtime
  USING      ("id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "memberships" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- users is a global identity table (no tenant_id): within a tenant, app_runtime sees only users
-- who hold a membership in that tenant. User creation/lookup-by-email happens outside tenant
-- context (identity module, via a privileged role) and is decided with the auth design.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_member_select ON "users" FOR SELECT TO app_runtime
  USING (EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."user_id" = "users"."id"
      AND m."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
  ));

ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_insert ON "outbox_events" FOR INSERT TO app_runtime
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
-- The publisher (app_system) reads and dispatches rows across all tenants.
CREATE POLICY system_all ON "outbox_events" TO app_system
  USING (true) WITH CHECK (true);

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "audit_log" FOR SELECT TO app_runtime
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_insert ON "audit_log" FOR INSERT TO app_runtime
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants (R-TEN-02, spec Appendix B.3). app_platform has BYPASSRLS and is used only by the
-- Administration module. Every table must be granted explicitly in its own migration: a
-- forgotten grant fails closed (permission denied) rather than exposing data.
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, app_runtime, app_system, app_platform;

GRANT SELECT, INSERT, UPDATE ON "businesses" TO app_runtime;       -- no DELETE: lifecycle via status
GRANT SELECT, INSERT, UPDATE, DELETE ON "memberships" TO app_runtime;
GRANT SELECT ON "users" TO app_runtime;                            -- visible only via a tenant membership
-- Outbox: runtime may only INSERT. Prisma create() uses RETURNING, which needs SELECT, so write
-- outbox rows with createMany()/$executeRaw (no RETURNING).
GRANT INSERT ON "outbox_events" TO app_runtime;
GRANT SELECT, UPDATE, DELETE ON "outbox_events" TO app_system;
GRANT USAGE ON SEQUENCE "outbox_events_seq_seq" TO app_runtime;
-- Inbox rows are written in the consumer's tenant transaction (R-EVT-06); pruning is by system.
GRANT SELECT, INSERT ON "processed_events" TO app_runtime;
GRANT SELECT, INSERT, DELETE ON "processed_events" TO app_system;
-- Audit log is append-only: no UPDATE/DELETE/TRUNCATE for any application role (R-SEC-04).
GRANT SELECT, INSERT ON "audit_log" TO app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_platform;
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM app_platform;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_platform;

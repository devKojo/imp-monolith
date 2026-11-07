-- Identity: password credentials, server-side sessions, email verification (R-IAM-01, R-IAM-04).
-- Identity rows are not tenant-scoped, so they are isolated by an "identity scope" set per
-- transaction (app.user_id, app.login_email, app.session_hash, app.verification_hash) in the same
-- way tenant rows are isolated by app.tenant_id. With no scope set, every policy returns no rows.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- Tables (from schema.prisma)
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMPTZ,
ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_failed_login_at" TIMESTAMPTZ,
ADD COLUMN     "locked_until" TIMESTAMPTZ,
ADD COLUMN     "password_hash" TEXT;

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "active_tenant_id" UUID,
    "active_membership_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_token_hash_key" ON "email_verifications"("token_hash");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_tenant_id_active_membership_id_fkey" FOREIGN KEY ("active_tenant_id", "active_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Raw-SQL objects
-- ---------------------------------------------------------------------------

-- Emails are stored normalised (trimmed, lower-cased); the unique index then dedupes correctly.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalised" CHECK ("email" = lower(btrim("email")));

-- Transaction-local scope value, NULL when unset or empty (fails closed).
CREATE FUNCTION app_setting(name text) RETURNS text
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting(name, true), '') $$;

-- ---------------------------------------------------------------------------
-- Row-level security for identity data
-- ---------------------------------------------------------------------------

-- users: visible/modifiable by the identity scope (own id, or the email being logged in).
CREATE POLICY identity_select ON "users" FOR SELECT TO app_runtime
  USING ("id" = app_setting('app.user_id')::uuid OR "email" = app_setting('app.login_email'));
CREATE POLICY identity_insert ON "users" FOR INSERT TO app_runtime
  WITH CHECK ("id" = app_setting('app.user_id')::uuid);
CREATE POLICY identity_update ON "users" FOR UPDATE TO app_runtime
  USING ("id" = app_setting('app.user_id')::uuid OR "email" = app_setting('app.login_email'))
  WITH CHECK ("id" = app_setting('app.user_id')::uuid OR "email" = app_setting('app.login_email'));

-- memberships / businesses: a user can list their own memberships and the businesses they belong to.
CREATE POLICY identity_select ON "memberships" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY identity_member_select ON "businesses" FOR SELECT TO app_runtime
  USING (EXISTS (
    SELECT 1 FROM "memberships" m
    WHERE m."tenant_id" = "businesses"."id" AND m."user_id" = app_setting('app.user_id')::uuid
  ));

-- sessions: looked up by token hash (before the user is known) or by owning user.
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY session_select ON "sessions" FOR SELECT TO app_runtime
  USING ("token_hash" = app_setting('app.session_hash') OR "user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY session_insert ON "sessions" FOR INSERT TO app_runtime
  WITH CHECK ("user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY session_update ON "sessions" FOR UPDATE TO app_runtime
  USING ("token_hash" = app_setting('app.session_hash') OR "user_id" = app_setting('app.user_id')::uuid)
  WITH CHECK ("user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY session_delete ON "sessions" FOR DELETE TO app_runtime
  USING ("user_id" = app_setting('app.user_id')::uuid);

-- email_verifications: looked up by token hash or by owning user.
ALTER TABLE "email_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_verifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY verification_select ON "email_verifications" FOR SELECT TO app_runtime
  USING ("token_hash" = app_setting('app.verification_hash') OR "user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY verification_insert ON "email_verifications" FOR INSERT TO app_runtime
  WITH CHECK ("user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY verification_update ON "email_verifications" FOR UPDATE TO app_runtime
  USING ("token_hash" = app_setting('app.verification_hash') OR "user_id" = app_setting('app.user_id')::uuid)
  WITH CHECK ("user_id" = app_setting('app.user_id')::uuid);

-- audit_log: authentication events have no tenant; allow platform-level rows (tenant_id IS NULL)
-- whose actor is the current identity, or anonymous (failed login for an unknown email).
CREATE POLICY identity_insert ON "audit_log" FOR INSERT TO app_runtime
  WITH CHECK ("tenant_id" IS NULL AND ("actor_id" IS NULL OR "actor_id" = app_setting('app.user_id')::uuid));

-- ---------------------------------------------------------------------------
-- Grants (explicit per table; no defaults)
-- ---------------------------------------------------------------------------

GRANT INSERT, UPDATE ON "users" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sessions" TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON "email_verifications" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sessions", "email_verifications" TO app_platform;

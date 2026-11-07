-- Password reset: single-use, expiring tokens (only a SHA-256 hash is stored, like email
-- verification). The row is reachable only by the token being redeemed or by its owning user.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_resets" FORCE ROW LEVEL SECURITY;
CREATE POLICY reset_select ON "password_resets" FOR SELECT TO app_runtime
  USING ("token_hash" = app_setting('app.reset_hash') OR "user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY reset_insert ON "password_resets" FOR INSERT TO app_runtime
  WITH CHECK ("user_id" = app_setting('app.user_id')::uuid);
CREATE POLICY reset_update ON "password_resets" FOR UPDATE TO app_runtime
  USING ("token_hash" = app_setting('app.reset_hash') OR "user_id" = app_setting('app.user_id')::uuid)
  WITH CHECK ("user_id" = app_setting('app.user_id')::uuid);

-- ---------------------------------------------------------------------------
-- Grants (explicit per table; no defaults)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON "password_resets" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "password_resets" TO app_platform;

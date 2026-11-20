-- Rewards, part 3 (ADR-R001): a participant claims an award.
--
--   * reward_claims: where a cash or item award should go. The destination is stored encrypted (AES-GCM, key
--     held by the server); "destination_hash" is a keyed hash so the same destination used by several
--     accounts can be spotted without decrypting; "destination_hint" is the masked tail shown back to people.
--     One claim per award. Insert-only for the runtime role.
--   * read-only participant policies, so a signed-in participant (not a member of the business) can read their
--     own awards, the timeline of those awards, and the prize, campaign and business names to show them.
--
-- Forced row-level security and composite FKs as everywhere else. Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "PayoutMethod" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER', 'DELIVERY');

CREATE TABLE "reward_claims" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "award_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "account_name" TEXT NOT NULL,
    "destination_enc" TEXT NOT NULL,
    "destination_hash" TEXT NOT NULL,
    "destination_hint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_claims_tenant_id_award_id_key" ON "reward_claims"("tenant_id", "award_id");
CREATE INDEX "reward_claims_tenant_id_destination_hash_idx" ON "reward_claims"("tenant_id", "destination_hash");
CREATE INDEX "reward_claims_tenant_id_user_id_idx" ON "reward_claims"("tenant_id", "user_id");

ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_tenant_id_award_id_fkey" FOREIGN KEY ("tenant_id", "award_id") REFERENCES "reward_awards"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reward_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reward_claims" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reward_claims" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON "reward_claims" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "reward_claims" TO app_platform;

-- ---------------------------------------------------------------------------
-- A participant reads their own awards. The server sets app.participant_user_id from the session.
-- ---------------------------------------------------------------------------

CREATE POLICY participant_read ON "reward_awards" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

-- The timeline of an award they own (the sub-query runs under the policy above).
CREATE POLICY participant_read ON "reward_events" FOR SELECT TO app_runtime
  USING ("award_id" IN (SELECT "id" FROM "reward_awards"));

-- The prize, the campaign and the business an award came from, so it can be shown by name.
CREATE POLICY participant_read ON "campaign_prizes" FOR SELECT TO app_runtime
  USING (app_setting('app.participant_user_id') IS NOT NULL AND "id" IN (SELECT "prize_id" FROM "reward_awards"));

CREATE POLICY participant_read ON "businesses" FOR SELECT TO app_runtime
  USING (app_setting('app.participant_user_id') IS NOT NULL AND "id" IN (SELECT "tenant_id" FROM "reward_awards"));

DROP POLICY "participant_read" ON "campaigns";
CREATE POLICY participant_read ON "campaigns" FOR SELECT TO app_runtime
  USING (
    app_setting('app.participant_user_id') IS NOT NULL
    AND "deleted_at" IS NULL
    AND (
      "id" IN (SELECT "campaign_id" FROM "quiz_attempts")
      OR "id" IN (SELECT "campaign_id" FROM "survey_responses")
      OR "id" IN (SELECT "campaign_id" FROM "votes")
      OR "id" IN (SELECT "campaign_id" FROM "giveaway_entries")
      OR "id" IN (SELECT "campaign_id" FROM "reward_awards")
    )
  );

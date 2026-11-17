-- Prize pools: a campaign may share one amount among a limited number of participants. The pool itself is
-- in the campaign settings; this counts who has joined, so the last seat can close the campaign atomically.
-- Additive: no grants change (app_runtime already UPDATEs campaigns).
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "campaigns" ADD COLUMN "participant_count" INTEGER NOT NULL DEFAULT 0;

-- Best effort for campaigns that already have participants (a no-op where row-level security hides rows).
UPDATE "campaigns" c SET "participant_count" =
  (SELECT count(DISTINCT a."user_id") FROM "quiz_attempts" a WHERE a."tenant_id" = c."tenant_id" AND a."campaign_id" = c."id")
  + (SELECT count(*) FROM "survey_responses" r WHERE r."tenant_id" = c."tenant_id" AND r."campaign_id" = c."id");

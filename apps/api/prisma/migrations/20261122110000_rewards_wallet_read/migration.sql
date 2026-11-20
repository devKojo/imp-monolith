-- A participant reads their own points entries (a balance per business) and their own claim (the masked
-- destination hint). Read-only; additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY participant_read ON "points_ledger" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

CREATE POLICY participant_read ON "reward_claims" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

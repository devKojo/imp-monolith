-- A participant's own page lists what they took part in, across businesses. Participation rows are tenant
-- tables, so a person who is not a member of any of those businesses could not read them. Add read-only
-- policies keyed on one transaction-local setting, app.participant_user_id, which the server sets from the
-- signed-in session (never from the request).
--
--   quiz_attempts, survey_responses : the person's own rows only.
--   campaigns                       : only the campaigns the person has an attempt or response in (and not
--                                     deleted), so a title and address can be shown. The sub-queries run
--                                     under the policies above, so they cannot widen the match.
--
-- SELECT only, no grants change. Unset or empty matches nothing.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY participant_read ON "quiz_attempts" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

CREATE POLICY participant_read ON "survey_responses" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

CREATE POLICY participant_read ON "campaigns" FOR SELECT TO app_runtime
  USING (
    app_setting('app.participant_user_id') IS NOT NULL
    AND "deleted_at" IS NULL
    AND (
      "id" IN (SELECT "campaign_id" FROM "quiz_attempts")
      OR "id" IN (SELECT "campaign_id" FROM "survey_responses")
    )
  );

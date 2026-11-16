-- A business can see who took part in its own campaigns. Until now a business could read only the users
-- who are members of it (tenant_member_select). This adds a second, permissive SELECT policy on users:
-- a user is visible to a business when they have a quiz attempt or a survey response in that business.
--
-- Fail-closed and scoped like every tenant policy: it depends on app.tenant_id (set by the server from
-- the signed-in person's active membership), and the EXISTS sub-queries run under the same forced RLS on
-- quiz_attempts and survey_responses, so only that business's rows can ever match. Read-only: no write
-- policy changes. The participants module selects only the id and name columns.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY tenant_participant_select ON "users" FOR SELECT TO app_runtime
  USING (
    EXISTS (
      SELECT 1 FROM "quiz_attempts" a
      WHERE a."user_id" = "users"."id"
        AND a."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM "survey_responses" s
      WHERE s."user_id" = "users"."id"
        AND s."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
  );

-- Supports "who took part in this business" (and the policy above) without scanning every attempt.
CREATE INDEX "quiz_attempts_tenant_id_user_id_idx" ON "quiz_attempts"("tenant_id", "user_id");
CREATE INDEX "survey_responses_tenant_id_user_id_idx" ON "survey_responses"("tenant_id", "user_id");

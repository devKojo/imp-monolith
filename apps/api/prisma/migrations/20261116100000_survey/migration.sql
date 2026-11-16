-- Surveys: a participant's response to a survey campaign and the answers given. The questions are the
-- campaign's own content fields (campaign_fields), so nothing about them moves here. Two tenant tables
-- with forced row-level security, composite FKs so every row stays inside one business (R-TEN-05), one
-- response per participant per campaign, and explicit grants. Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "choice_index" INTEGER,
    "text" TEXT,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_tenant_id_id_key" ON "survey_responses"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_tenant_id_campaign_id_user_id_key" ON "survey_responses"("tenant_id", "campaign_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_answers_tenant_id_response_id_question_id_key" ON "survey_answers"("tenant_id", "response_id", "question_id");

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_tenant_id_response_id_fkey" FOREIGN KEY ("tenant_id", "response_id") REFERENCES "survey_responses"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_tenant_id_question_id_fkey" FOREIGN KEY ("tenant_id", "question_id") REFERENCES "campaign_fields"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Guards the application also enforces (defence in depth, R-DAT-03)
-- ---------------------------------------------------------------------------

ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_choice_nonneg" CHECK ("choice_index" IS NULL OR "choice_index" >= 0);
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_text_length" CHECK ("text" IS NULL OR char_length("text") BETWEEN 1 AND 4000);
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_one_value" CHECK (("choice_index" IS NULL) <> ("text" IS NULL));

-- ---------------------------------------------------------------------------
-- Row-level security (R-TEN-01): the same fail-closed policy as every tenant table. A participant is not
-- a member of the business, so the server sets the business from the campaign it looked up by address
-- (never from the request) and only ever touches that participant's own response.
-- ---------------------------------------------------------------------------

ALTER TABLE "survey_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "survey_responses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "survey_responses" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "survey_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "survey_answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "survey_answers" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants. Answers are replaced as the participant changes their mind or clears an optional one, so they
-- need DELETE; responses are never deleted by the runtime role.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON "survey_responses" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "survey_answers" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "survey_responses", "survey_answers" TO app_platform;

-- Quizzes: questions with a correct answer, a time limit and pass mark per campaign, and the
-- participant attempt with the answers they chose. Four tenant tables with forced row-level
-- security, composite FKs so every row stays inside one business (R-TEN-05), one attempt per
-- participant per campaign, and explicit grants. Additive only: no existing object is changed.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "time_limit_minutes" INTEGER,
    "pass_percent" INTEGER NOT NULL DEFAULT 70,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correct_index" INTEGER NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "submitted_at" TIMESTAMPTZ,
    "score" INTEGER,
    "total" INTEGER,
    "passed" BOOLEAN,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "choice_index" INTEGER NOT NULL,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_tenant_id_campaign_id_key" ON "quizzes"("tenant_id", "campaign_id");
CREATE UNIQUE INDEX "quiz_questions_tenant_id_id_key" ON "quiz_questions"("tenant_id", "id");
CREATE INDEX "quiz_questions_tenant_id_campaign_id_position_idx" ON "quiz_questions"("tenant_id", "campaign_id", "position");
CREATE UNIQUE INDEX "quiz_attempts_tenant_id_id_key" ON "quiz_attempts"("tenant_id", "id");
CREATE UNIQUE INDEX "quiz_attempts_tenant_id_campaign_id_user_id_key" ON "quiz_attempts"("tenant_id", "campaign_id", "user_id");
CREATE UNIQUE INDEX "quiz_answers_tenant_id_attempt_id_question_id_key" ON "quiz_answers"("tenant_id", "attempt_id", "question_id");

-- AddForeignKey (composite: a row can only point at a parent of its own business)
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_tenant_id_attempt_id_fkey" FOREIGN KEY ("tenant_id", "attempt_id") REFERENCES "quiz_attempts"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_tenant_id_question_id_fkey" FOREIGN KEY ("tenant_id", "question_id") REFERENCES "quiz_questions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guards the application also enforces (defence in depth, R-DAT-03)
-- ---------------------------------------------------------------------------

ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_time_limit_range" CHECK ("time_limit_minutes" IS NULL OR "time_limit_minutes" BETWEEN 1 AND 240);
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_pass_percent_range" CHECK ("pass_percent" BETWEEN 1 AND 100);
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_prompt_length" CHECK (char_length("prompt") BETWEEN 1 AND 300);
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_options_count" CHECK (cardinality("options") BETWEEN 2 AND 6);
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_correct_in_range" CHECK ("correct_index" >= 0 AND "correct_index" < cardinality("options"));
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_position_nonneg" CHECK ("position" >= 0);
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_finished_has_score" CHECK ("submitted_at" IS NULL OR ("score" IS NOT NULL AND "total" IS NOT NULL AND "passed" IS NOT NULL));
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_choice_nonneg" CHECK ("choice_index" >= 0);

-- ---------------------------------------------------------------------------
-- Row-level security (R-TEN-01): same fail-closed policy as every tenant table. A participant is not
-- a member of the business, so the server sets the business from the campaign it looked up by
-- address (never from the request) and only ever touches that participant's own attempt.
-- ---------------------------------------------------------------------------

ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quizzes" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quiz_questions" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quiz_attempts" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "quiz_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "quiz_answers" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants (explicit per table). Questions and settings are replaced as a set while drafting, so they
-- need DELETE. Attempts and answers are never deleted by the runtime role.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON "quizzes", "quiz_questions" TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON "quiz_attempts", "quiz_answers" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "quizzes", "quiz_questions", "quiz_attempts", "quiz_answers" TO app_platform;

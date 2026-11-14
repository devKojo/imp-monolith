-- Campaign content moves onto the campaign. Templates stop being business-authored forms and become
-- built-in campaign types (quiz, survey, giveaway, instant win): global, seeded, read-only for
-- businesses, each listing the field kinds a campaign of that type may use.
--
--  * campaign_templates / campaign_template_fields: the built-in types (global, no tenant, no RLS).
--  * campaign_fields: what a campaign asks and contains (participant details, quiz and survey
--    questions), one tenant table with forced RLS. Quiz questions move here from quiz_questions, with the
--    same ids so recorded answers stay valid.
--  * campaigns.settings: the quiz time limit and pass mark move here from quizzes.
--  * campaigns.template_id now points at a built-in type. Each campaign gets the type matching its old
--    template's archetype, and the old template's fields are copied onto the campaign.
--
-- The retired tables `templates` and `template_fields` are no longer used by the application and are left
-- in place, untouched, to be dropped in a follow-up once this has been verified.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

-- CreateEnum
CREATE TYPE "CampaignFieldKind" AS ENUM ('FULL_NAME', 'EMAIL', 'PHONE', 'ADDRESS', 'WALLET', 'CHOICE', 'LIKERT', 'UPLOAD', 'TEXT', 'LONG_TEXT', 'CONSENT', 'QUIZ_QUESTION');

-- CreateTable
CREATE TABLE "campaign_templates" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" "TemplateArchetype" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "min_content_fields" INTEGER NOT NULL DEFAULT 0,
    "requires_prizes" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_template_fields" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "kind" "CampaignFieldKind" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "max_count" INTEGER,
    "default_count" INTEGER NOT NULL DEFAULT 0,
    "default_label" TEXT NOT NULL DEFAULT '',
    "default_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "campaign_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_fields" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "CampaignFieldKind" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helper" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correct_index" INTEGER,

    CONSTRAINT "campaign_fields_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "campaign_templates_slug_key" ON "campaign_templates"("slug");
CREATE UNIQUE INDEX "campaign_template_fields_template_id_kind_key" ON "campaign_template_fields"("template_id", "kind");
CREATE UNIQUE INDEX "campaign_fields_tenant_id_id_key" ON "campaign_fields"("tenant_id", "id");
CREATE UNIQUE INDEX "campaign_fields_tenant_id_campaign_id_key_key" ON "campaign_fields"("tenant_id", "campaign_id", "key");
CREATE INDEX "campaign_fields_tenant_id_campaign_id_position_idx" ON "campaign_fields"("tenant_id", "campaign_id", "position");

-- AddForeignKey
ALTER TABLE "campaign_template_fields" ADD CONSTRAINT "campaign_template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "campaign_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guards the application also enforces (defence in depth, R-DAT-03)
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_min_content_nonneg" CHECK ("min_content_fields" >= 0);
ALTER TABLE "campaign_template_fields" ADD CONSTRAINT "campaign_template_fields_counts" CHECK (("max_count" IS NULL OR "max_count" >= 1) AND "default_count" >= 0 AND ("max_count" IS NULL OR "default_count" <= "max_count"));
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]*$' AND char_length("key") <= 60);
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_label_length" CHECK (char_length("label") <= 300);
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_helper_length" CHECK (char_length("helper") <= 240);
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_options_count" CHECK (cardinality("options") <= 20);
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_position_nonneg" CHECK ("position" >= 0);
-- Only a quiz question has a correct answer, and it must be one of its options.
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_correct_index" CHECK ("correct_index" IS NULL OR ("kind" = 'QUIZ_QUESTION' AND "correct_index" >= 0 AND "correct_index" < cardinality("options")));

-- ---------------------------------------------------------------------------
-- The built-in types. Fixed ids, so the same rows exist in every environment.
-- ---------------------------------------------------------------------------

INSERT INTO "campaign_templates" ("id", "slug", "name", "archetype", "description", "min_content_fields", "requires_prizes", "position") VALUES
  ('01a1e000-0000-7000-8000-000000000001', 'quiz',     'Quiz',        'QUIZ',     'Questions with one correct answer each, scored on a pass mark.', 1, false, 1),
  ('01a1e000-0000-7000-8000-000000000002', 'survey',   'Survey',      'SURVEY',   'Questions with no right answer: choices, ratings and written replies.', 1, false, 2),
  ('01a1e000-0000-7000-8000-000000000003', 'giveaway', 'Giveaway',    'GIVEAWAY', 'Participants enter once for a chance to win a prize.', 0, true, 3),
  ('01a1e000-0000-7000-8000-000000000004', 'instant',  'Instant win', 'INSTANT',  'Participants find out straight away whether they won.', 0, true, 4);

-- kind, max, default count, default label, default required, per type (position follows the listing order)
INSERT INTO "campaign_template_fields" ("id", "template_id", "kind", "position", "max_count", "default_count", "default_label", "default_required")
SELECT gen_random_uuid(), t.id, f.kind::"CampaignFieldKind", f.position, f.max_count, f.default_count, f.default_label, f.default_required
FROM "campaign_templates" t
JOIN (VALUES
  ('quiz', 'EMAIL',         1, 1,  1, 'Email address',    true),
  ('quiz', 'PHONE',         2, 1,  0, 'Mobile number',    false),
  ('quiz', 'FULL_NAME',     3, 1,  0, 'Full name',        false),
  ('quiz', 'CONSENT',       4, 1,  1, 'I agree to the rules and the privacy notice', true),
  ('quiz', 'QUIZ_QUESTION', 5, 50, 0, 'Question',         true),

  ('survey', 'EMAIL',     1, 1,  1, 'Email address', true),
  ('survey', 'PHONE',     2, 1,  0, 'Mobile number', false),
  ('survey', 'FULL_NAME', 3, 1,  0, 'Full name',     false),
  ('survey', 'CONSENT',   4, 1,  1, 'I agree to the privacy notice', true),
  ('survey', 'CHOICE',    5, 50, 0, 'Question',      false),
  ('survey', 'LIKERT',    6, 50, 0, 'Rate from 1 to 5', false),
  ('survey', 'TEXT',      7, 50, 0, 'Short answer',  false),
  ('survey', 'LONG_TEXT', 8, 50, 0, 'Long answer',   false),

  ('giveaway', 'EMAIL',     1, 1, 1, 'Email address', true),
  ('giveaway', 'PHONE',     2, 1, 0, 'Mobile number', false),
  ('giveaway', 'FULL_NAME', 3, 1, 0, 'Full name',     false),
  ('giveaway', 'ADDRESS',   4, 1, 0, 'Delivery address', false),
  ('giveaway', 'WALLET',    5, 1, 0, 'Wallet address', false),
  ('giveaway', 'CONSENT',   6, 1, 1, 'I agree to the rules and the privacy notice', true),

  ('instant', 'EMAIL',     1, 1, 1, 'Email address', true),
  ('instant', 'PHONE',     2, 1, 0, 'Mobile number', false),
  ('instant', 'FULL_NAME', 3, 1, 0, 'Full name',     false),
  ('instant', 'ADDRESS',   4, 1, 0, 'Delivery address', false),
  ('instant', 'WALLET',    5, 1, 0, 'Wallet address', false),
  ('instant', 'CONSENT',   6, 1, 1, 'I agree to the rules and the privacy notice', true)
) AS f(slug, kind, position, max_count, default_count, default_label, default_required) ON f.slug = t.slug;

-- ---------------------------------------------------------------------------
-- Row-level security and grants for the new campaign table (same fail-closed policy as every tenant table)
-- ---------------------------------------------------------------------------

ALTER TABLE "campaign_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_fields" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "campaign_fields" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_fields" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_fields" TO app_platform;
-- The built-in types are read by everyone and changed only by the platform.
GRANT SELECT ON "campaign_templates", "campaign_template_fields" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_templates", "campaign_template_fields" TO app_platform;

-- ---------------------------------------------------------------------------
-- Move the data
-- ---------------------------------------------------------------------------

-- Row-level security is forced on these tables, which applies even to the role running this migration
-- (it would see no rows, and every statement below would quietly do nothing). It is switched off for
-- the move and forced again straight after, inside the same transaction.
ALTER TABLE "campaigns" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "campaign_fields" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "templates" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "template_fields" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" NO FORCE ROW LEVEL SECURITY;

-- 1. The old template's fields become the campaign's own fields (only kinds the new type allows).
INSERT INTO "campaign_fields" ("id", "tenant_id", "campaign_id", "position", "kind", "key", "label", "helper", "required", "options")
SELECT gen_random_uuid(), c."tenant_id", c."id", f."position", f."kind"::text::"CampaignFieldKind", f."key", f."label", f."helper", f."required", f."options"
FROM "campaigns" c
JOIN "templates" t ON t."tenant_id" = c."tenant_id" AND t."id" = c."template_id"
JOIN "template_fields" f ON f."tenant_id" = t."tenant_id" AND f."template_id" = t."id"
JOIN "campaign_templates" ct ON ct."archetype" = t."archetype"
JOIN "campaign_template_fields" ctf ON ctf."template_id" = ct."id" AND ctf."kind" = f."kind"::text::"CampaignFieldKind";

-- 2. Quiz questions become campaign fields, keeping their ids so recorded answers stay valid.
INSERT INTO "campaign_fields" ("id", "tenant_id", "campaign_id", "position", "kind", "key", "label", "helper", "required", "options", "correct_index")
SELECT q."id", q."tenant_id", q."campaign_id", 1000 + q."position", 'QUIZ_QUESTION', 'quiz_question_' || (q."position" + 1), q."prompt", '', true, q."options", q."correct_index"
FROM "quiz_questions" q;

-- 3. Answers now point at campaign fields.
ALTER TABLE "quiz_answers" DROP CONSTRAINT "quiz_answers_tenant_id_question_id_fkey";
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_tenant_id_question_id_fkey" FOREIGN KEY ("tenant_id", "question_id") REFERENCES "campaign_fields"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. The quiz time limit and pass mark move onto the campaign.
UPDATE "campaigns" c
SET "settings" = jsonb_build_object('quiz', jsonb_build_object('timeLimitMinutes', z."time_limit_minutes", 'passPercent', z."pass_percent"))
FROM "quizzes" z
WHERE z."tenant_id" = c."tenant_id" AND z."campaign_id" = c."id";

-- 5. Each campaign takes the built-in type matching its old template.
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_tenant_id_template_id_fkey";
UPDATE "campaigns" c
SET "template_id" = ct."id"
FROM "templates" t
JOIN "campaign_templates" ct ON ct."archetype" = t."archetype"
WHERE t."tenant_id" = c."tenant_id" AND t."id" = c."template_id";
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "campaign_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. What was moved is no longer needed.
DROP TABLE "quiz_questions";
DROP TABLE "quizzes";

ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;
ALTER TABLE "campaign_fields" FORCE ROW LEVEL SECURITY;
ALTER TABLE "templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "template_fields" FORCE ROW LEVEL SECURITY;

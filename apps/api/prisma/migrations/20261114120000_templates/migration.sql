-- Campaign templates: a reusable entry-form blueprint per business (tenant). Two tenant tables with
-- forced row-level security, a composite FK (R-TEN-05), soft delete on templates (R-DAT-09) and
-- explicit grants. Additive only: no existing object is changed.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- CreateEnum
CREATE TYPE "TemplateArchetype" AS ENUM ('GIVEAWAY', 'QUIZ', 'SURVEY', 'INSTANT');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TemplateFieldKind" AS ENUM ('FULL_NAME', 'EMAIL', 'PHONE', 'ADDRESS', 'WALLET', 'CHOICE', 'LIKERT', 'UPLOAD', 'TEXT', 'CONSENT');

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" "TemplateArchetype" NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_fields" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "TemplateFieldKind" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helper" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "templates_tenant_id_id_key" ON "templates"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "templates_tenant_id_status_idx" ON "templates"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "templates_tenant_id_updated_at_idx" ON "templates"("tenant_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "template_fields_tenant_id_template_id_key_key" ON "template_fields"("tenant_id", "template_id", "key");

-- CreateIndex
CREATE INDEX "template_fields_tenant_id_template_id_position_idx" ON "template_fields"("tenant_id", "template_id", "position");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_tenant_id_template_id_fkey" FOREIGN KEY ("tenant_id", "template_id") REFERENCES "templates"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guards the application also enforces (defence in depth, R-DAT-03)
-- ---------------------------------------------------------------------------

ALTER TABLE "templates" ADD CONSTRAINT "templates_name_length" CHECK (char_length("name") BETWEEN 1 AND 120);
ALTER TABLE "templates" ADD CONSTRAINT "templates_version_positive" CHECK ("version" >= 1);
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]{0,63}$');
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_position_nonneg" CHECK ("position" >= 0);

-- ---------------------------------------------------------------------------
-- Row-level security (R-TEN-01): same fail-closed policy as every tenant table.
-- ---------------------------------------------------------------------------

ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "templates" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "template_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "template_fields" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "template_fields" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants (explicit per table). Templates are never hard-deleted by the runtime role: deletion is
-- a status change (deleted_at). Fields are replaced as a set on save, so they need DELETE.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON "templates" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "template_fields" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "templates", "template_fields" TO app_platform;

-- Campaigns: what a business runs from a published template (title, page text, prize tiers, schedule).
-- Two tenant tables with forced row-level security, a composite FK to templates (R-TEN-05), soft delete
-- on campaigns (R-DAT-09), a globally unique slug for the public page (R-TEN-07) and explicit grants.
-- Additive only: no existing object is changed.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "slug" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "start_at" TIMESTAMPTZ,
    "end_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "launched_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_prizes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value_label" TEXT NOT NULL DEFAULT '',
    "winners" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "campaign_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_tenant_id_id_key" ON "campaigns"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_status_idx" ON "campaigns"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_updated_at_idx" ON "campaigns"("tenant_id", "updated_at");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_template_id_idx" ON "campaigns"("tenant_id", "template_id");

-- CreateIndex
CREATE INDEX "campaign_prizes_tenant_id_campaign_id_position_idx" ON "campaign_prizes"("tenant_id", "campaign_id", "position");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (composite: a campaign can only use a template of its own business; MATCH SIMPLE
-- leaves it unchecked while template_id is NULL)
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_template_id_fkey" FOREIGN KEY ("tenant_id", "template_id") REFERENCES "templates"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guards the application also enforces (defence in depth, R-DAT-03)
-- ---------------------------------------------------------------------------

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_title_length" CHECK (char_length("title") BETWEEN 1 AND 120);
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_summary_length" CHECK (char_length("summary") <= 600);
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_version_positive" CHECK ("version" >= 1);
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_schedule_order" CHECK ("start_at" IS NULL OR "end_at" IS NULL OR "end_at" > "start_at");
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_slug_format" CHECK ("slug" IS NULL OR "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
-- A campaign that is no longer a draft has its public address and a closing time.
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_launched_has_slug_and_end" CHECK ("status" = 'DRAFT' OR ("slug" IS NOT NULL AND "end_at" IS NOT NULL));
ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_winners_range" CHECK ("winners" BETWEEN 1 AND 100000);
ALTER TABLE "campaign_prizes" ADD CONSTRAINT "campaign_prizes_position_nonneg" CHECK ("position" >= 0);

-- ---------------------------------------------------------------------------
-- Row-level security (R-TEN-01): same fail-closed policy as every tenant table.
-- ---------------------------------------------------------------------------

ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "campaigns" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "campaign_prizes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign_prizes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "campaign_prizes" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants (explicit per table). Campaigns are never hard-deleted by the runtime role: deletion is a
-- status change (deleted_at). Prizes are replaced as a set on save, so they need DELETE.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON "campaigns" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "campaign_prizes" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "campaigns", "campaign_prizes" TO app_platform;

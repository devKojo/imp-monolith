-- Rewards, part 4 (ADR-R001, R5): scam reports and a shared rate limiter.
--
--   * scam_reports: a winner reports that an award looks like a scam. The reporter reads their own; there is
--     deliberately no tenant read policy, so the business can neither read the reports nor tell who made
--     them. The tenant role may only insert (the winner's claim path runs in the award's business scope).
--     One report per award, person and reason.
--   * rate_limit_counters: fixed-window counters so limits hold across server instances. Keys are opaque
--     (hashed or ids); no personal data, so no row-level security: it is keyed by caller, not by business.
--
-- Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "ScamReason" AS ENUM ('ASKED_TO_PAY', 'SUSPICIOUS_CONTACT', 'NOT_RECEIVED', 'OTHER');
CREATE TYPE "ScamReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

CREATE TABLE "scam_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "award_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" "ScamReason" NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "severity" INTEGER NOT NULL,
    "status" "ScamReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scam_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scam_reports_tenant_id_award_id_user_id_reason_key" ON "scam_reports"("tenant_id", "award_id", "user_id", "reason");
CREATE INDEX "scam_reports_tenant_id_campaign_id_idx" ON "scam_reports"("tenant_id", "campaign_id");
CREATE INDEX "scam_reports_status_severity_idx" ON "scam_reports"("status", "severity");

ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_tenant_id_award_id_fkey" FOREIGN KEY ("tenant_id", "award_id") REFERENCES "reward_awards"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scam_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scam_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_insert ON "scam_reports" FOR INSERT TO app_runtime
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY participant_read ON "scam_reports" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

GRANT SELECT, INSERT ON "scam_reports" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "scam_reports" TO app_platform;

CREATE TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key", "window_start")
);

CREATE INDEX "rate_limit_counters_window_start_idx" ON "rate_limit_counters"("window_start");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit_counters" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit_counters" TO app_platform;

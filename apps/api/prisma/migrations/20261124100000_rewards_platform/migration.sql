-- Rewards, part 5 (ADR-R001, R6): platform review.
--
--   * platform_staff: who works for the platform and may review rewards across businesses. No grant to the
--     runtime role: only app_platform (BYPASSRLS, administration module) reads it. Rows are added by an operator.
--   * scam_reports gains who resolved a report, when, and a note.
--
-- Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_REVIEWER');

CREATE TABLE "platform_staff" (
    "user_id" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'PLATFORM_REVIEWER',
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "platform_staff_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_staff" TO app_platform;

ALTER TABLE "scam_reports" ADD COLUMN "resolved_by" UUID, ADD COLUMN "resolved_at" TIMESTAMPTZ, ADD COLUMN "resolution" TEXT NOT NULL DEFAULT '';
ALTER TABLE "scam_reports" ADD CONSTRAINT "scam_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

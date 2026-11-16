-- Archiving: a business can put a finished or draft campaign away without deleting it, and bring it back.
-- It is a timestamp beside the status, not a status, so unarchiving restores exactly what it was.
-- Additive: no grants change (app_runtime already UPDATEs campaigns).
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "campaigns" ADD COLUMN "archived_at" TIMESTAMPTZ;

CREATE INDEX "campaigns_tenant_id_archived_at_idx" ON "campaigns" ("tenant_id", "archived_at");

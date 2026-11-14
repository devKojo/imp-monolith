-- Public discovery: let the public listing read campaigns that are running, across businesses.
--
-- Same pattern as the identity module's non-tenant reads: a transaction-local setting
-- (`app.public_read = 'on'`, set only by `withPublic`) opens extra, PERMISSIVE read policies on
-- app_runtime. Without the setting these policies match nothing, so every tenant-scoped query behaves
-- exactly as before (and a business still cannot read another business's drafts, prizes or templates).
--
-- What the setting can read, and no more (all SELECT only, no grants change):
--   campaigns        that are live (or scheduled and already started), not deleted, with an address
--                    and an end time still ahead
--   campaign_prizes  of those campaigns
--   templates        used by those campaigns (the page needs the kind of campaign; never the fields)
--   businesses       that run those campaigns and are not suspended or deactivated
--
-- The policies deliberately do not reference each other in a cycle: campaigns looks at nothing else,
-- the others look at campaigns. Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY public_read ON "campaigns" FOR SELECT TO app_runtime
  USING (
    app_setting('app.public_read') = 'on'
    AND "deleted_at" IS NULL
    AND "slug" IS NOT NULL
    AND "end_at" > now()
    AND ("status" = 'LIVE' OR ("status" = 'SCHEDULED' AND "start_at" <= now()))
  );

CREATE POLICY public_read ON "campaign_prizes" FOR SELECT TO app_runtime
  USING (
    app_setting('app.public_read') = 'on'
    AND EXISTS (
      SELECT 1 FROM "campaigns" c
      WHERE c."id" = "campaign_prizes"."campaign_id" AND c."tenant_id" = "campaign_prizes"."tenant_id"
    )
  );

CREATE POLICY public_read ON "templates" FOR SELECT TO app_runtime
  USING (
    app_setting('app.public_read') = 'on'
    AND EXISTS (
      SELECT 1 FROM "campaigns" c
      WHERE c."template_id" = "templates"."id" AND c."tenant_id" = "templates"."tenant_id"
    )
  );

CREATE POLICY public_read ON "businesses" FOR SELECT TO app_runtime
  USING (
    app_setting('app.public_read') = 'on'
    AND "status" IN ('PENDING', 'ACTIVE')
    AND EXISTS (SELECT 1 FROM "campaigns" c WHERE c."tenant_id" = "businesses"."id")
  );

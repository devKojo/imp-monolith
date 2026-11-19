-- A prize pool campaign that has taken its last participant is stored as COMPLETED while its end date is
-- still ahead (the schedule's own completion is computed, never stored). The public scope could not read
-- it, so a full campaign vanished: people already holding a seat could not resume or submit, a new
-- person got "not found" instead of "campaign full", and its page said it was unavailable.
--
-- Widen the public_read policy on campaigns to those rows, and only those: stored COMPLETED, not deleted,
-- with an address, an end still ahead and a prize pool. The other public_read policies follow campaigns, so
-- they need no change. Still SELECT only, no grants change. The public listing leaves these campaigns out in
-- its own query; a campaign's own page and the quiz and survey lookups can read them.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER POLICY public_read ON "campaigns"
  USING (
    app_setting('app.public_read') = 'on'
    AND "deleted_at" IS NULL
    AND "slug" IS NOT NULL
    AND "end_at" > now()
    AND (
      "status" = 'LIVE'
      OR ("status" = 'SCHEDULED' AND "start_at" <= now())
      OR ("status" = 'COMPLETED' AND "settings"->'pool' IS NOT NULL)
    )
  );

-- A made draw is public by design: anyone can re-run it from its published facts (ADR-R001). Until the draw
-- is made its nonce is secret, so only rows with a "drawn_at" are readable through the public scope, and
-- they hold entrant references and winners, never names. Read-only; additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE POLICY public_read ON "reward_draws" FOR SELECT TO app_runtime
  USING (app_setting('app.public_read') = 'on' AND "drawn_at" IS NOT NULL);

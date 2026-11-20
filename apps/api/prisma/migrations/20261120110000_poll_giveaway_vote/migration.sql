-- Poll, image vote and giveaway campaigns, part 2.
--
--   * the built-in types "Poll" and "Image vote" (the giveaway already exists) and the fields they allow;
--   * votes: one per participant per campaign, for an option of a poll or a candidate of an image vote;
--   * giveaway entries: one per participant per campaign, with a ticket number;
--   * the read-only policies that let a business see who took part and a participant see their own.
--
-- Two tenant tables with forced row-level security, composite FKs so every row stays inside one business
-- (R-TEN-05), and explicit grants. Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- The built-in types. Fixed ids, so the same rows exist in every environment.
-- ---------------------------------------------------------------------------

INSERT INTO "campaign_templates" ("id", "slug", "name", "archetype", "description", "min_content_fields", "requires_prizes", "position") VALUES
  ('01a1e000-0000-7000-8000-000000000005', 'poll', 'Poll',       'POLL', 'One question with a few answers; each participant votes once and sees how everyone voted.', 1, false, 5),
  ('01a1e000-0000-7000-8000-000000000006', 'vote', 'Image vote', 'VOTE', 'Candidates with a picture each; every participant votes for one of them.', 2, false, 6);

INSERT INTO "campaign_template_fields" ("id", "template_id", "kind", "position", "max_count", "default_count", "default_label", "default_required")
SELECT gen_random_uuid(), t.id, f.kind::"CampaignFieldKind", f.position, f.max_count, f.default_count, f.default_label, f.default_required
FROM "campaign_templates" t
JOIN (VALUES
  ('poll', 'EMAIL',     1, 1,  1, 'Email address', true),
  ('poll', 'PHONE',     2, 1,  0, 'Mobile number', false),
  ('poll', 'FULL_NAME', 3, 1,  0, 'Full name',     false),
  ('poll', 'CONSENT',   4, 1,  1, 'I agree to the privacy notice', true),
  ('poll', 'CHOICE',    5, 1,  1, 'Question',      true),

  ('vote', 'EMAIL',     1, 1,  1, 'Email address', true),
  ('vote', 'PHONE',     2, 1,  0, 'Mobile number', false),
  ('vote', 'FULL_NAME', 3, 1,  0, 'Full name',     false),
  ('vote', 'CONSENT',   4, 1,  1, 'I agree to the privacy notice', true),
  ('vote', 'CANDIDATE', 5, 20, 2, 'Candidate',     true)
) AS f(slug, kind, position, max_count, default_count, default_label, default_required) ON f.slug = t.slug;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- CreateTable. "field_id" is the poll's question or the image vote's candidate that was chosen;
-- "choice_index" is which answer of the poll's question (null for an image vote: the candidate is the field).
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "choice_index" INTEGER,
    "cast_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable. "ticket_number" is 1, 2, 3... in the order people entered the campaign.
CREATE TABLE "giveaway_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ticket_number" INTEGER NOT NULL,
    "entered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "votes_tenant_id_id_key" ON "votes"("tenant_id", "id");
CREATE UNIQUE INDEX "votes_tenant_id_campaign_id_user_id_key" ON "votes"("tenant_id", "campaign_id", "user_id");
CREATE INDEX "votes_tenant_id_campaign_id_field_id_idx" ON "votes"("tenant_id", "campaign_id", "field_id");
CREATE INDEX "votes_tenant_id_user_id_idx" ON "votes"("tenant_id", "user_id");
CREATE UNIQUE INDEX "giveaway_entries_tenant_id_id_key" ON "giveaway_entries"("tenant_id", "id");
CREATE UNIQUE INDEX "giveaway_entries_tenant_id_campaign_id_user_id_key" ON "giveaway_entries"("tenant_id", "campaign_id", "user_id");
CREATE UNIQUE INDEX "giveaway_entries_tenant_id_campaign_id_ticket_number_key" ON "giveaway_entries"("tenant_id", "campaign_id", "ticket_number");
CREATE INDEX "giveaway_entries_tenant_id_user_id_idx" ON "giveaway_entries"("tenant_id", "user_id");

-- AddForeignKey (composite: a row can only point at a parent of its own business)
ALTER TABLE "votes" ADD CONSTRAINT "votes_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_tenant_id_field_id_fkey" FOREIGN KEY ("tenant_id", "field_id") REFERENCES "campaign_fields"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_tenant_id_campaign_id_fkey" FOREIGN KEY ("tenant_id", "campaign_id") REFERENCES "campaigns"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Guards the application also enforces (defence in depth, R-DAT-03)
-- ---------------------------------------------------------------------------

ALTER TABLE "votes" ADD CONSTRAINT "votes_choice_nonneg" CHECK ("choice_index" IS NULL OR "choice_index" >= 0);
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_ticket_positive" CHECK ("ticket_number" >= 1);

-- ---------------------------------------------------------------------------
-- Row-level security (R-TEN-01): the same fail-closed policy as every tenant table. A participant is not
-- a member of the business, so the server sets the business from the campaign it looked up by address
-- (never from the request) and only ever touches that participant's own rows.
-- ---------------------------------------------------------------------------

ALTER TABLE "votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "votes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "votes" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "giveaway_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "giveaway_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "giveaway_entries" TO app_runtime
  USING      ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Grants. A vote and an entry are final: the runtime role never updates or deletes them.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON "votes", "giveaway_entries" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "votes", "giveaway_entries" TO app_platform;

-- ---------------------------------------------------------------------------
-- A participant's own page lists what they took part in (see participant_read_own_participations).
-- ---------------------------------------------------------------------------

CREATE POLICY participant_read ON "votes" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

CREATE POLICY participant_read ON "giveaway_entries" FOR SELECT TO app_runtime
  USING ("user_id" = app_setting('app.participant_user_id')::uuid);

DROP POLICY "participant_read" ON "campaigns";
CREATE POLICY participant_read ON "campaigns" FOR SELECT TO app_runtime
  USING (
    app_setting('app.participant_user_id') IS NOT NULL
    AND "deleted_at" IS NULL
    AND (
      "id" IN (SELECT "campaign_id" FROM "quiz_attempts")
      OR "id" IN (SELECT "campaign_id" FROM "survey_responses")
      OR "id" IN (SELECT "campaign_id" FROM "votes")
      OR "id" IN (SELECT "campaign_id" FROM "giveaway_entries")
    )
  );

-- A business sees the names of the people who took part in its campaigns, now including votes and entries.
DROP POLICY "tenant_participant_select" ON "users";
CREATE POLICY tenant_participant_select ON "users" FOR SELECT TO app_runtime
  USING (
    EXISTS (
      SELECT 1 FROM "quiz_attempts" a
      WHERE a."user_id" = "users"."id"
        AND a."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM "survey_responses" s
      WHERE s."user_id" = "users"."id"
        AND s."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM "votes" v
      WHERE v."user_id" = "users"."id"
        AND v."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM "giveaway_entries" g
      WHERE g."user_id" = "users"."id"
        AND g."tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
  );

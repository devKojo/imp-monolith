-- Polls with several questions.
--
--   * a poll may now have up to ten questions (it was one): the template allows ten "choice" fields;
--   * "votes.answers" holds the participant's answer to every question as { "<question field id>": <answer
--     number> }. A participant still has exactly one row per campaign, so the one-ballot-per-person key and
--     every count of voters stay as they were. Rows cast before this change have no answers; their
--     "field_id" / "choice_index" are the answer to the poll's only question, and are still read that way.
--
-- Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

UPDATE "campaign_template_fields" f
SET "max_count" = 10
FROM "campaign_templates" t
WHERE f."template_id" = t."id" AND t."slug" = 'poll' AND f."kind" = 'CHOICE';

ALTER TABLE "votes" ADD COLUMN "answers" JSONB;

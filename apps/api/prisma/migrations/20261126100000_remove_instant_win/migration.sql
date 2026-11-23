-- Instant win is no longer a campaign type. Its built-in template goes, and the INSTANT value is removed from
-- the two enums that carried it. PostgreSQL cannot drop an enum value, so each enum is rebuilt.
--
-- Safe to fail: campaigns.template_id references campaign_templates without cascade, so if any campaign
-- (including a draft or archived one; row security hides them from a migration) still uses the instant
-- template the DELETE below stops with a foreign key error and nothing changes. Remove or move those
-- campaigns first. Prize rows set to INSTANT (never settled by the engine) fall back to the type's default.
-- An award whose source is INSTANT cannot exist (none were ever created); the cast would stop if one did.

DELETE FROM "campaign_templates" WHERE "archetype" = 'INSTANT';

ALTER TYPE "TemplateArchetype" RENAME TO "TemplateArchetype_old";
CREATE TYPE "TemplateArchetype" AS ENUM ('GIVEAWAY', 'QUIZ', 'SURVEY', 'POLL', 'VOTE');
ALTER TABLE "campaign_templates"
  ALTER COLUMN "archetype" TYPE "TemplateArchetype" USING "archetype"::text::"TemplateArchetype";
DROP TYPE "TemplateArchetype_old";

ALTER TYPE "PrizeSelection" RENAME TO "PrizeSelection_old";
CREATE TYPE "PrizeSelection" AS ENUM ('RANKING', 'DRAW', 'POOL', 'COMPLETION');
ALTER TABLE "campaign_prizes"
  ALTER COLUMN "selection" TYPE "PrizeSelection"
  USING (CASE WHEN "selection"::text = 'INSTANT' THEN NULL ELSE "selection"::text::"PrizeSelection" END);
ALTER TABLE "reward_awards"
  ALTER COLUMN "source" TYPE "PrizeSelection" USING "source"::text::"PrizeSelection";
DROP TYPE "PrizeSelection_old";

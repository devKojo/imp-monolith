-- Poll, image vote and giveaway campaigns, part 1: the enum values and the column they need. Enum values
-- added in a transaction cannot be used until it commits, so the rows that use them are in the next
-- migration. Additive only.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TYPE "TemplateArchetype" ADD VALUE IF NOT EXISTS 'POLL';
ALTER TYPE "TemplateArchetype" ADD VALUE IF NOT EXISTS 'VOTE';

-- A candidate in an image vote: its name is the field label, its description the helper, and its picture
-- is a link (https). Empty for every other kind of field.
ALTER TYPE "CampaignFieldKind" ADD VALUE IF NOT EXISTS 'CANDIDATE';

ALTER TABLE "campaign_fields" ADD COLUMN "image_url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_image_url" CHECK ("image_url" = '' OR ("image_url" ~ '^https://[^[:space:]]+$' AND char_length("image_url") <= 500));

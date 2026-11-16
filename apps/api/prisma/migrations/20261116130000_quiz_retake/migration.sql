-- Quiz retakes: an attempt is numbered per participant per campaign (1, 2, ...), up to the "attempts
-- allowed" setting on the campaign (campaigns.settings.quiz.maxAttempts, default 1). Every existing attempt
-- becomes attempt 1, so nothing changes for quizzes already taken. The one-attempt unique key is replaced by
-- one that includes the number; it still stops a double click or a second tab from creating the same
-- attempt twice.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "attempt_number" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX "quiz_attempts_tenant_id_campaign_id_user_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_tenant_id_campaign_id_user_id_attempt_number_key" ON "quiz_attempts"("tenant_id", "campaign_id", "user_id", "attempt_number");

-- Guard the application also enforces (defence in depth, R-DAT-03)
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_attempt_number_positive" CHECK ("attempt_number" >= 1);

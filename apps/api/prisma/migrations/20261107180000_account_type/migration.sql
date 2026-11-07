-- Separate participant and business accounts (ADR-009 amendment, see docs/adr). Existing users
-- are all business owners, so BUSINESS is the default. Policies and grants are unchanged: the
-- column is covered by the existing identity_* policies on "users".
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BUSINESS', 'PARTICIPANT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'BUSINESS';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralSource" TEXT;

-- Backfill: every user that existed before this migration shipped already
-- knows the product (they signed up before onboarding existed), so flip them
-- onboarded so we don't dump them into the onboarding flow on next login.
UPDATE "user" SET "isOnboarded" = true;

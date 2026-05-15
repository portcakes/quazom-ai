-- Polar subscription + scholarly title rollout.
--
-- Adds the columns the polar webhook needs to mirror a user's paid plan
-- back into the User row (`subscriptionPlan`, `subscriptionInterval`,
-- `polarCustomerId`) plus the bookkeeping for the "Founding Explorer /
-- Founding Scholar" reward titles introduced alongside the upgrade flow:
--   - `earnedTitles` is the stable list of slugs the user has unlocked
--     (kept forever, even on downgrade — they paid to earn it).
--   - `selectedTitle` is the slug currently displayed beside the user's
--     name in the sidebar.
--
-- All columns are nullable / defaulted so existing alpha users remain
-- untouched after the deploy.

-- AlterTable
ALTER TABLE "user"
  ADD COLUMN "subscriptionPlan"     TEXT,
  ADD COLUMN "subscriptionInterval" TEXT,
  ADD COLUMN "polarCustomerId"      TEXT,
  ADD COLUMN "earnedTitles"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "selectedTitle"        TEXT;

-- CreateIndex: webhook lookup path is `WHERE polarCustomerId = ?`, so add
-- a non-unique index. We keep it non-unique because in dev the same user
-- may end up rebound to a fresh customer id during local testing.
CREATE INDEX "user_polarCustomerId_idx" ON "user"("polarCustomerId");

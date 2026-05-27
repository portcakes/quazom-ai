-- Skippable Discussion lessons
--
-- Adds a `wasSkipped` flag to the `discussion` table so the UI can tell
-- which completed discussions were genuinely engaged with vs. skipped past
-- via the new Skip action. The flag is purely additive and existing rows
-- backfill to false (the default); curriculum progression treats skipped
-- and completed discussions identically (`isCompleted=true`), so no
-- existing user state is invalidated.

ALTER TABLE "discussion"
  ADD COLUMN "wasSkipped" BOOLEAN NOT NULL DEFAULT false;

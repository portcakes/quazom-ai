-- AlterTable: add the learner's IANA timezone so daily check-ins anchor to
-- their local calendar day instead of UTC. Defaults to UTC for existing rows
-- to preserve current behaviour until the user opts in via Settings.
ALTER TABLE "user" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable: Module gets a level batch indicator so a single curriculum can
-- contain modules from beginner, intermediate, and advanced progressions.
ALTER TABLE "module" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'beginner';

-- Backfill existing modules with their curriculum's level so the progression
-- UI doesn't treat them all as beginner.
UPDATE "module" m
SET "level" = LOWER(c."level")
FROM "curriculum" c
WHERE m."curriculumId" = c."id";

-- AlterTable: Quiz gets pre-assessment study material plus a generation flag.
ALTER TABLE "quiz"
  ADD COLUMN "overview" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "content" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "recommendedResources" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "questionsGenerated" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "questions" SET DEFAULT '[]';

-- AlterTable: Exercise mirrors Quiz for the new pre-assessment fields.
ALTER TABLE "exercise"
  ADD COLUMN "overview" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "content" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "recommendedResources" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "questionsGenerated" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "questions" SET DEFAULT '[]';

-- Mark any quiz/exercise that already has questions as generated so existing
-- assessments keep working without forcing the learner to re-generate them.
UPDATE "quiz" SET "questionsGenerated" = true WHERE jsonb_array_length("questions") > 0;
UPDATE "exercise" SET "questionsGenerated" = true WHERE jsonb_array_length("questions") > 0;

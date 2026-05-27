-- Multi-Source & Continuity Curriculum Generation
--
-- Adds the schema needed to support curricula that are generated from
-- multiple inputs (extra topics, uploaded files, saved links) instead of
-- the historical "subject + level + goal" tuple. Continuity Curricula
-- count against a separate per-plan quota and may carry a thesis. Both
-- single-source and continuity curricula can be fine-tuned with a
-- lesson-type filter and now go through a PENDING/READY/FAILED lifecycle.
--
-- Migration is purely additive — existing rows backfill to
-- (kind=SINGLE, status=READY, full activity-type set) so no UX regression.

-- New enums --------------------------------------------------------------
CREATE TYPE "CurriculumKind" AS ENUM ('SINGLE', 'CONTINUITY');
CREATE TYPE "CurriculumStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "CurriculumSourceKind" AS ENUM (
  'TOPIC',
  'LINK_RESOURCE',
  'FILE_RESOURCE',
  'CONTINUITY_NOTE'
);

-- Extend AiUsageKind so the admin console can break out continuity vs
-- single-source curriculum spend and thesis generation specifically.
ALTER TYPE "AiUsageKind" ADD VALUE 'CURRICULUM_CONTINUITY';
ALTER TYPE "AiUsageKind" ADD VALUE 'CURRICULUM_THESIS';

-- Curriculum table additions --------------------------------------------
ALTER TABLE "curriculum"
  ADD COLUMN "kind" "CurriculumKind" NOT NULL DEFAULT 'SINGLE',
  ADD COLUMN "status" "CurriculumStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "statusMessage" TEXT,
  ADD COLUMN "thesis" TEXT,
  ADD COLUMN "includedActivityTypes" "LessonActivityType"[] NOT NULL
    DEFAULT ARRAY['VIDEO','QUIZ','EXERCISE','PROJECT','DISCUSSION','READING','OTHER']::"LessonActivityType"[];

-- Backfill: every existing row was created the old way (Inngest wrote a
-- finished curriculum directly), so they should land in READY and stay
-- SINGLE. The default on `status` is PENDING for new inserts; the
-- single UPDATE below flips already-persisted rows so the detail page
-- doesn't briefly render the pending shell for legacy curricula.
UPDATE "curriculum" SET "status" = 'READY' WHERE "status" = 'PENDING';

CREATE INDEX "curriculum_userId_kind_idx" ON "curriculum" ("userId", "kind");
CREATE INDEX "curriculum_status_idx" ON "curriculum" ("status");

-- New CurriculumSource table --------------------------------------------
CREATE TABLE "curriculum_source" (
  "id"               TEXT NOT NULL,
  "curriculumId"     TEXT NOT NULL,
  "kind"             "CurriculumSourceKind" NOT NULL,
  "order"            INTEGER NOT NULL DEFAULT 0,
  "topicText"        TEXT,
  "resourceId"       TEXT,
  "continuityNoteId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "curriculum_source_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "curriculum_source_curriculumId_idx" ON "curriculum_source" ("curriculumId");
CREATE INDEX "curriculum_source_resourceId_idx" ON "curriculum_source" ("resourceId");

ALTER TABLE "curriculum_source"
  ADD CONSTRAINT "curriculum_source_curriculumId_fkey"
  FOREIGN KEY ("curriculumId") REFERENCES "curriculum"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "curriculum_source"
  ADD CONSTRAINT "curriculum_source_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

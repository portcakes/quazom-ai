-- Knowledge Sandboxes
--
-- Adds research workspaces ("Sandboxes") that live next to Curricula under
-- the shared "Studies" umbrella. A Sandbox collects Sources, hosts multi-turn
-- AI Research Sessions, and can generate Materials (readings/quizzes/projects)
-- that cite the user's sources. Materials are real Lesson rows under a hidden
-- backing Curriculum (curriculum.sandboxId) so the existing lesson generator,
-- viewer, and monthly lesson cap are reused unchanged.
--
-- Migration is purely additive — no existing rows are touched besides adding
-- the nullable `curriculum.sandboxId` column (NULL for every existing row).

-- New enums --------------------------------------------------------------
CREATE TYPE "SandboxSourceKind" AS ENUM (
  'TOPIC',
  'LINK_RESOURCE',
  'FILE_RESOURCE',
  'CONTINUITY_NOTE',
  'THESIS',
  'QUESTION'
);

CREATE TYPE "SandboxMaterialKind" AS ENUM ('READING', 'QUIZ', 'PROJECT');

-- Track research-session chat spend distinctly in the admin console.
ALTER TYPE "AiUsageKind" ADD VALUE 'RESEARCH_REPLY';

-- Sandbox table ----------------------------------------------------------
CREATE TABLE "sandbox" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "thesis"      TEXT,
  "isHidden"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sandbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sandbox_userId_idx" ON "sandbox" ("userId");

ALTER TABLE "sandbox"
  ADD CONSTRAINT "sandbox_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Curriculum backing link ------------------------------------------------
ALTER TABLE "curriculum" ADD COLUMN "sandboxId" TEXT;

CREATE UNIQUE INDEX "curriculum_sandboxId_key" ON "curriculum" ("sandboxId");

ALTER TABLE "curriculum"
  ADD CONSTRAINT "curriculum_sandboxId_fkey"
  FOREIGN KEY ("sandboxId") REFERENCES "sandbox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- SandboxSource table ----------------------------------------------------
CREATE TABLE "sandbox_source" (
  "id"               TEXT NOT NULL,
  "sandboxId"        TEXT NOT NULL,
  "kind"             "SandboxSourceKind" NOT NULL,
  "order"            INTEGER NOT NULL DEFAULT 0,
  "label"            TEXT NOT NULL DEFAULT '',
  "text"             TEXT,
  "resourceId"       TEXT,
  "continuityNoteId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sandbox_source_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sandbox_source_sandboxId_idx" ON "sandbox_source" ("sandboxId");
CREATE INDEX "sandbox_source_resourceId_idx" ON "sandbox_source" ("resourceId");

ALTER TABLE "sandbox_source"
  ADD CONSTRAINT "sandbox_source_sandboxId_fkey"
  FOREIGN KEY ("sandboxId") REFERENCES "sandbox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sandbox_source"
  ADD CONSTRAINT "sandbox_source_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ResearchSession table --------------------------------------------------
CREATE TABLE "research_session" (
  "id"          TEXT NOT NULL,
  "sandboxId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL DEFAULT 'Research Session',
  "sourceIds"   JSONB NOT NULL DEFAULT '[]',
  "chatHistory" JSONB NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "research_session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "research_session_sandboxId_idx" ON "research_session" ("sandboxId");

ALTER TABLE "research_session"
  ADD CONSTRAINT "research_session_sandboxId_fkey"
  FOREIGN KEY ("sandboxId") REFERENCES "sandbox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- SandboxMaterial table --------------------------------------------------
CREATE TABLE "sandbox_material" (
  "id"        TEXT NOT NULL,
  "sandboxId" TEXT NOT NULL,
  "lessonId"  TEXT NOT NULL,
  "kind"      "SandboxMaterialKind" NOT NULL,
  "sourceIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sandbox_material_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sandbox_material_lessonId_key" ON "sandbox_material" ("lessonId");
CREATE INDEX "sandbox_material_sandboxId_idx" ON "sandbox_material" ("sandboxId");

ALTER TABLE "sandbox_material"
  ADD CONSTRAINT "sandbox_material_sandboxId_fkey"
  FOREIGN KEY ("sandboxId") REFERENCES "sandbox"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sandbox_material"
  ADD CONSTRAINT "sandbox_material_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

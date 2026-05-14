-- Resources & notes-tweaks migration.
--
-- Introduces the `resource` table (learner-owned uploads to Cloudflare R2
-- and saved external links) plus its M:N joins to curriculum and lesson;
-- gives notes a `tags` array and an optional `resourceId` FK so resource
-- annotations roll up into a note the same way lesson annotations do;
-- relaxes annotation.lessonId / annotation.annotation to nullable so a
-- highlight can sit on a resource and a colour-only highlight (no
-- commentary) is a valid row; adds annotation.color so the renderer picks
-- the right Tailwind class.

-- ---- Enums --------------------------------------------------------------

-- CreateEnum
CREATE TYPE "AnnotationColor" AS ENUM ('YELLOW', 'PINK', 'BLUE', 'ORANGE', 'GREEN');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('LINK', 'FILE');

-- CreateEnum
CREATE TYPE "ResourceFileType" AS ENUM ('TXT', 'PDF', 'MD');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- ---- Note: tags + resource FK ------------------------------------------

-- AlterTable: store optional learner-supplied tags inline as a Postgres
-- TEXT[] so the notes listing can filter / facet without a side table.
-- Default `'{}'` so existing rows behave like untagged notes.
ALTER TABLE "note"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "resourceId" TEXT;

-- CreateIndex
CREATE INDEX "note_resourceId_idx" ON "note"("resourceId");

-- ---- Annotation: nullable lesson / annotation, add resource + colour ----

-- AlterTable: drop the NOT NULL constraint on lessonId so an annotation
-- can target a resource instead; make `annotation` text optional so a
-- colour-only highlight (no commentary) is allowed; add `resourceId` FK
-- and `color` enum.
ALTER TABLE "annotation" ALTER COLUMN "lessonId" DROP NOT NULL;
ALTER TABLE "annotation" ALTER COLUMN "annotation" DROP NOT NULL;
ALTER TABLE "annotation" ADD COLUMN "resourceId" TEXT;
ALTER TABLE "annotation" ADD COLUMN "color" "AnnotationColor" NOT NULL DEFAULT 'YELLOW';

-- CreateIndex
CREATE INDEX "annotation_resourceId_idx" ON "annotation"("resourceId");

-- ---- Resource table -----------------------------------------------------

-- CreateTable: learner-owned references (uploads on R2 or saved URLs).
-- One row per resource; the explicit join tables below attach a resource
-- to 0..N curricula and 0..N lessons.
CREATE TABLE "resource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "domain" TEXT,
    "extractedAt" TIMESTAMP(3),
    "fileKey" TEXT,
    "fileType" "ResourceFileType",
    "fileSize" INTEGER,
    "fileMimeType" TEXT,
    "fileName" TEXT,
    "content" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_userId_idx" ON "resource"("userId");
CREATE INDEX "resource_userId_kind_idx" ON "resource"("userId", "kind");
CREATE INDEX "resource_status_idx" ON "resource"("status");

-- ---- Resource ↔ Curriculum join ----------------------------------------

-- CreateTable
CREATE TABLE "resource_curriculum" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_curriculum_resourceId_curriculumId_key"
  ON "resource_curriculum"("resourceId", "curriculumId");
CREATE INDEX "resource_curriculum_curriculumId_idx"
  ON "resource_curriculum"("curriculumId");

-- ---- Resource ↔ Lesson join --------------------------------------------

-- CreateTable
CREATE TABLE "resource_lesson" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_lesson_resourceId_lessonId_key"
  ON "resource_lesson"("resourceId", "lessonId");
CREATE INDEX "resource_lesson_lessonId_idx"
  ON "resource_lesson"("lessonId");

-- ---- Foreign keys -------------------------------------------------------

-- AddForeignKey: Note → Resource (SetNull so notes survive resource deletes).
ALTER TABLE "note"
  ADD CONSTRAINT "note_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Annotation → Resource (Cascade because an annotation
-- against a deleted resource has no anchor).
ALTER TABLE "annotation"
  ADD CONSTRAINT "annotation_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Resource → User.
ALTER TABLE "resource"
  ADD CONSTRAINT "resource_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ResourceCurriculum → Resource / Curriculum.
ALTER TABLE "resource_curriculum"
  ADD CONSTRAINT "resource_curriculum_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_curriculum"
  ADD CONSTRAINT "resource_curriculum_curriculumId_fkey"
  FOREIGN KEY ("curriculumId") REFERENCES "curriculum"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ResourceLesson → Resource / Lesson.
ALTER TABLE "resource_lesson"
  ADD CONSTRAINT "resource_lesson_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_lesson"
  ADD CONSTRAINT "resource_lesson_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

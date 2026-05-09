/*
  Warnings:

  - The values [PRACTICE] on the enum `LessonActivityType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `aiResponses` on the `discussion` table. All the data in the column will be lost.
  - You are about to drop the column `chatSummary` on the `discussion` table. All the data in the column will be lost.
  - You are about to drop the column `feedback` on the `discussion` table. All the data in the column will be lost.
  - You are about to drop the column `userResponses` on the `discussion` table. All the data in the column will be lost.
  - You are about to drop the column `correctAnswers` on the `exercise` table. All the data in the column will be lost.
  - You are about to drop the column `instructions` on the `exercise` table. All the data in the column will be lost.
  - You are about to drop the column `projectFileUrl` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `projectUrl` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `answers` on the `quiz` table. All the data in the column will be lost.
  - You are about to drop the column `correctAnswers` on the `quiz` table. All the data in the column will be lost.
  - You are about to drop the `lesson_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quiz_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reading_notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_notes` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `chatHistory` on table `discussion` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `questions` to the `exercise` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('STUB', 'GENERATING', 'READY', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "LessonActivityType_new" AS ENUM ('VIDEO', 'QUIZ', 'EXERCISE', 'PROJECT', 'DISCUSSION', 'READING', 'OTHER');
ALTER TABLE "lesson" ALTER COLUMN "activityType" TYPE "LessonActivityType_new" USING ("activityType"::text::"LessonActivityType_new");
ALTER TYPE "LessonActivityType" RENAME TO "LessonActivityType_old";
ALTER TYPE "LessonActivityType_new" RENAME TO "LessonActivityType";
DROP TYPE "public"."LessonActivityType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "lesson_notes" DROP CONSTRAINT "lesson_notes_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "quiz_notes" DROP CONSTRAINT "quiz_notes_quizId_fkey";

-- DropForeignKey
ALTER TABLE "reading_notes" DROP CONSTRAINT "reading_notes_readingId_fkey";

-- DropForeignKey
ALTER TABLE "user_notes" DROP CONSTRAINT "user_notes_userId_fkey";

-- AlterTable
ALTER TABLE "discussion" DROP COLUMN "aiResponses",
DROP COLUMN "chatSummary",
DROP COLUMN "feedback",
DROP COLUMN "userResponses",
ALTER COLUMN "chatHistory" SET NOT NULL,
ALTER COLUMN "chatHistory" SET DEFAULT '[]';

-- AlterTable
ALTER TABLE "exercise" DROP COLUMN "correctAnswers",
DROP COLUMN "instructions",
ADD COLUMN     "questions" JSONB NOT NULL,
ALTER COLUMN "hints" SET DEFAULT '[]';

-- AlterTable
ALTER TABLE "lesson" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "LessonStatus" NOT NULL DEFAULT 'STUB',
ALTER COLUMN "summary" SET DEFAULT '',
ALTER COLUMN "content" SET DEFAULT '',
ALTER COLUMN "duration" SET DEFAULT '',
ALTER COLUMN "objectives" SET DEFAULT '[]',
ALTER COLUMN "recommendedResources" SET DEFAULT '[]';

-- AlterTable
ALTER TABLE "module" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "project" DROP COLUMN "projectFileUrl",
DROP COLUMN "projectUrl",
ADD COLUMN     "submissionUrl" TEXT;

-- AlterTable
ALTER TABLE "quiz" DROP COLUMN "answers",
DROP COLUMN "correctAnswers";

-- AlterTable
ALTER TABLE "readings" ADD COLUMN     "overview" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "video" ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "overview" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "duration" SET DEFAULT '',
ALTER COLUMN "duration" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "lesson_notes";

-- DropTable
DROP TABLE "quiz_notes";

-- DropTable
DROP TABLE "reading_notes";

-- DropTable
DROP TABLE "user_notes";

-- CreateTable
CREATE TABLE "note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "curriculumId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_userId_idx" ON "note"("userId");

-- CreateIndex
CREATE INDEX "note_lessonId_idx" ON "note"("lessonId");

-- CreateIndex
CREATE INDEX "note_curriculumId_idx" ON "note"("curriculumId");

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

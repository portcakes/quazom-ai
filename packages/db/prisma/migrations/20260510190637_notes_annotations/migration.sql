-- AlterTable
ALTER TABLE "note" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isAnnotation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "annotation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "annotation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "annotation_userId_idx" ON "annotation"("userId");

-- CreateIndex
CREATE INDEX "annotation_lessonId_idx" ON "annotation"("lessonId");

-- CreateIndex
CREATE INDEX "annotation_noteId_idx" ON "annotation"("noteId");

-- AddForeignKey
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

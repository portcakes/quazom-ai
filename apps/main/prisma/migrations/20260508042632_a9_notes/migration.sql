-- CreateTable
CREATE TABLE "reading_notes" (
    "id" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reading_notes_readingId_idx" ON "reading_notes"("readingId");

-- AddForeignKey
ALTER TABLE "reading_notes" ADD CONSTRAINT "reading_notes_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "readings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

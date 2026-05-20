-- CreateTable
CREATE TABLE "continuity_note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuity_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "continuity_note_userId_idx" ON "continuity_note"("userId");

-- AddForeignKey
ALTER TABLE "continuity_note" ADD CONSTRAINT "continuity_note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

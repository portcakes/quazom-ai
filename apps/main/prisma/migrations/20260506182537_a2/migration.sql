-- CreateTable
CREATE TABLE "curriculum" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "raw_ai_response" TEXT NOT NULL,
    "structured_data_json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curriculum_userId_idx" ON "curriculum"("userId");

-- AddForeignKey
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

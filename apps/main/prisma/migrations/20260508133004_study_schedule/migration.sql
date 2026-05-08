-- CreateEnum
CREATE TYPE "StudyTimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT');

-- CreateTable
CREATE TABLE "study_schedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "minutesPerDay" INTEGER NOT NULL,
    "targetCompletionDate" TIMESTAMP(3) NOT NULL,
    "preferredTimeSlots" "StudyTimeSlot"[],
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warningsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_session" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timeSlot" "StudyTimeSlot" NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "lessonIds" JSONB NOT NULL,
    "lessonTitles" JSONB NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_in_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "study_schedule_curriculumId_key" ON "study_schedule"("curriculumId");

-- CreateIndex
CREATE INDEX "study_schedule_userId_idx" ON "study_schedule"("userId");

-- CreateIndex
CREATE INDEX "study_session_scheduleId_idx" ON "study_session"("scheduleId");

-- CreateIndex
CREATE INDEX "study_session_userId_date_idx" ON "study_session"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "study_session_userId_date_timeSlot_key" ON "study_session"("userId", "date", "timeSlot");

-- CreateIndex
CREATE INDEX "check_in_userId_idx" ON "check_in"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_userId_date_key" ON "check_in"("userId", "date");

-- AddForeignKey
ALTER TABLE "study_schedule" ADD CONSTRAINT "study_schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_schedule" ADD CONSTRAINT "study_schedule_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "study_schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

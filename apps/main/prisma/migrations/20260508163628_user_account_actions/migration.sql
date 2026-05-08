-- CreateEnum
CREATE TYPE "AccountAction" AS ENUM ('DISABLE', 'DELETE');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "isAlpha" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "account_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "action" "AccountAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_feedback_action_idx" ON "account_feedback"("action");

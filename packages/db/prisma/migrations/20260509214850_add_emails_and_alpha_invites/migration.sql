-- AlterTable
ALTER TABLE "waitlist_entry" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "welcomeEmailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "alpha_invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "waitlistEntryId" TEXT,
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alpha_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alpha_invite_accessKey_key" ON "alpha_invite"("accessKey");

-- CreateIndex
CREATE INDEX "alpha_invite_email_idx" ON "alpha_invite"("email");

-- CreateIndex
CREATE INDEX "alpha_invite_expiresAt_idx" ON "alpha_invite"("expiresAt");

-- CreateIndex
CREATE INDEX "waitlist_entry_invitedAt_idx" ON "waitlist_entry"("invitedAt");

-- AddForeignKey
ALTER TABLE "alpha_invite" ADD CONSTRAINT "alpha_invite_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "waitlist_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

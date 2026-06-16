-- AlterTable
ALTER TABLE "AbandonedCartSession" ADD COLUMN "reminderStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AbandonedCartSession" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "AbandonedCartSession" ADD COLUMN "unsubscribed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AbandonedCartSession_reminderStage_idx" ON "AbandonedCartSession"("reminderStage");

-- CreateIndex
CREATE INDEX "AbandonedCartSession_unsubscribed_idx" ON "AbandonedCartSession"("unsubscribed");

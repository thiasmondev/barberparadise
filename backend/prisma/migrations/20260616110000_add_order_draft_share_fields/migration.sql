-- Add secure customer share link fields for admin order drafts
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "draftShareTokenHash" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "draftShareSentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "draftShareExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "draftShareLastAccessedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "draftShareConvertedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_draftShareTokenHash_key" ON "Order"("draftShareTokenHash");
CREATE INDEX IF NOT EXISTS "Order_draftShareSentAt_idx" ON "Order"("draftShareSentAt");

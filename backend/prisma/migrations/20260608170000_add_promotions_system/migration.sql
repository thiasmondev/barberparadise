-- Add Shopify-like promotions system while keeping the legacy PromoCode model intact.

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "promotionId" TEXT;

CREATE TABLE IF NOT EXISTS "Promotion" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "method" TEXT NOT NULL DEFAULT 'code',
  "type" TEXT NOT NULL,
  "value" DOUBLE PRECISION,
  "valueType" TEXT DEFAULT 'percentage',
  "appliesTo" TEXT NOT NULL DEFAULT 'all',
  "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "categoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minOrderAmount" DOUBLE PRECISION,
  "minQuantity" INTEGER,
  "customerType" TEXT NOT NULL DEFAULT 'all',
  "usageLimit" INTEGER,
  "usagePerCustomer" INTEGER DEFAULT 1,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PromotionUsage" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "orderId" TEXT,
  "customerId" TEXT,
  "customerEmail" TEXT,
  "discountAmount" DOUBLE PRECISION NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_code_key" ON "Promotion"("code");
CREATE INDEX IF NOT EXISTS "Promotion_code_idx" ON "Promotion"("code");
CREATE INDEX IF NOT EXISTS "Promotion_method_idx" ON "Promotion"("method");
CREATE INDEX IF NOT EXISTS "Promotion_isActive_idx" ON "Promotion"("isActive");
CREATE INDEX IF NOT EXISTS "Promotion_startsAt_endsAt_idx" ON "Promotion"("startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "PromotionUsage_promotionId_idx" ON "PromotionUsage"("promotionId");
CREATE INDEX IF NOT EXISTS "PromotionUsage_customerId_idx" ON "PromotionUsage"("customerId");
CREATE INDEX IF NOT EXISTS "PromotionUsage_orderId_idx" ON "PromotionUsage"("orderId");
CREATE INDEX IF NOT EXISTS "Order_promotionId_idx" ON "Order"("promotionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromotionUsage_promotionId_fkey'
  ) THEN
    ALTER TABLE "PromotionUsage"
    ADD CONSTRAINT "PromotionUsage_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_promotionId_fkey'
  ) THEN
    ALTER TABLE "Order"
    ADD CONSTRAINT "Order_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

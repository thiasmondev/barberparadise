-- Agent Marketing BarberParadise
-- Ajouts compatibles avec une base Render PostgreSQL déjà en production.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "promoCodeId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "tone" TEXT NOT NULL DEFAULT 'expert',
  "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "productIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "content" JSONB,
  "generatedAssets" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "minAmount" DOUBLE PRECISION,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "campaignId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailCampaign" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "htmlContent" TEXT NOT NULL,
  "textContent" TEXT,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "brevoCampaignId" INTEGER,
  "brevoListId" INTEGER,
  "segment" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketingSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingSetting_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
UPDATE "BlogPost" SET "coverImage" = NULLIF("image", '') WHERE "coverImage" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BlogPost' AND column_name = 'image');
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "categorySlug" TEXT;
UPDATE "BlogPost" SET "categorySlug" = COALESCE(NULLIF("category", ''), 'guide') WHERE "categorySlug" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BlogPost' AND column_name = 'category');
UPDATE "BlogPost" SET "categorySlug" = 'guide' WHERE "categorySlug" IS NULL;
ALTER TABLE "BlogPost" ALTER COLUMN "categorySlug" SET NOT NULL;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "status" TEXT;
UPDATE "BlogPost" SET "status" = CASE WHEN COALESCE("published", false) THEN 'published' ELSE 'draft' END WHERE "status" IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BlogPost' AND column_name = 'published');
UPDATE "BlogPost" SET "status" = 'draft' WHERE "status" IS NULL;
ALTER TABLE "BlogPost" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "BlogPost" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
UPDATE "BlogPost" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL AND "status" = 'published';
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaign_slug_key" ON "MarketingCampaign"("slug");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_type_idx" ON "MarketingCampaign"("type");
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX IF NOT EXISTS "PromoCode_active_idx" ON "PromoCode"("active");
CREATE INDEX IF NOT EXISTS "PromoCode_campaignId_idx" ON "PromoCode"("campaignId");
CREATE INDEX IF NOT EXISTS "EmailCampaign_status_idx" ON "EmailCampaign"("status");
CREATE INDEX IF NOT EXISTS "EmailCampaign_campaignId_idx" ON "EmailCampaign"("campaignId");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingSetting_key_key" ON "MarketingSetting"("key");
CREATE INDEX IF NOT EXISTS "BlogPost_status_idx" ON "BlogPost"("status");
CREATE INDEX IF NOT EXISTS "BlogPost_categorySlug_idx" ON "BlogPost"("categorySlug");
CREATE INDEX IF NOT EXISTS "BlogPost_campaignId_idx" ON "BlogPost"("campaignId");
CREATE INDEX IF NOT EXISTS "Order_promoCodeId_idx" ON "Order"("promoCodeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoCode_campaignId_fkey') THEN
    ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmailCampaign_campaignId_fkey') THEN
    ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlogPost_campaignId_fkey') THEN
    ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_promoCodeId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

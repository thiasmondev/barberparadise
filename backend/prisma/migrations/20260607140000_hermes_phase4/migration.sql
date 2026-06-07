-- Hermes Agent Phase 4 — Image Generator + Analytics
-- Migration additive : création des tables HermesImage et MarketingKPI.

CREATE TABLE "HermesImage" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "model" TEXT NOT NULL,
    "replicateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "replicateUrl" TEXT,
    "cloudinaryUrl" TEXT,
    "cloudinaryId" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1024,
    "height" INTEGER NOT NULL DEFAULT 1024,
    "aspectRatio" TEXT NOT NULL DEFAULT '1:1',
    "format" TEXT NOT NULL DEFAULT 'webp',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conversationId" TEXT,
    "messageId" TEXT,
    "durationMs" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HermesImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingKPI" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "emailsSent" INTEGER,
    "emailsOpened" INTEGER,
    "emailsClicked" INTEGER,
    "emailsBounced" INTEGER,
    "emailsUnsubs" INTEGER,
    "blogPostsPublished" INTEGER,
    "socialPostsCreated" INTEGER,
    "productDescsUpdated" INTEGER,
    "hermesConversations" INTEGER,
    "hermesMessages" INTEGER,
    "hermesTokensUsed" INTEGER,
    "hermesCostUsd" DOUBLE PRECISION,
    "imagesGenerated" INTEGER,
    "imagesCostUsd" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingKPI_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HermesImage_status_idx" ON "HermesImage"("status");
CREATE INDEX "HermesImage_category_idx" ON "HermesImage"("category");
CREATE INDEX "HermesImage_createdAt_idx" ON "HermesImage"("createdAt");

CREATE UNIQUE INDEX "MarketingKPI_date_source_key" ON "MarketingKPI"("date", "source");
CREATE INDEX "MarketingKPI_date_idx" ON "MarketingKPI"("date");
CREATE INDEX "MarketingKPI_source_idx" ON "MarketingKPI"("source");

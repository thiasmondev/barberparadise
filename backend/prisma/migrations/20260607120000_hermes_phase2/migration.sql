-- Hermes Agent Phase 2 — Content Engine + Campaign Manager
-- Migration additive et défensive pour préserver les données Phase 1 existantes.

ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "campaignPlanId" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "seoMetaTitle" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "seoMetaDescription" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "seoSlug" TEXT;
ALTER TABLE "ContentDraft" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CampaignPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetAudience" TEXT NOT NULL,
  "brevoListIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "htmlContent" TEXT,
  "strategyBrief" TEXT,
  "estimatedROI" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'draft',
  "brevoCampaignId" INTEGER,
  "sentAt" TIMESTAMP(3),
  "metricsSent" INTEGER,
  "metricsDelivered" INTEGER,
  "metricsOpened" INTEGER,
  "metricsClicked" INTEGER,
  "metricsUnsubscribed" INTEGER,
  "metricsBounced" INTEGER,
  "conversationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentDraft_conversationId_idx" ON "ContentDraft"("conversationId");
CREATE INDEX IF NOT EXISTS "ContentDraft_campaignPlanId_idx" ON "ContentDraft"("campaignPlanId");
CREATE INDEX IF NOT EXISTS "ContentDraft_publishedAt_idx" ON "ContentDraft"("publishedAt");
CREATE INDEX IF NOT EXISTS "CampaignPlan_status_idx" ON "CampaignPlan"("status");
CREATE INDEX IF NOT EXISTS "CampaignPlan_targetAudience_idx" ON "CampaignPlan"("targetAudience");
CREATE INDEX IF NOT EXISTS "CampaignPlan_scheduledAt_idx" ON "CampaignPlan"("scheduledAt");
CREATE INDEX IF NOT EXISTS "CampaignPlan_sentAt_idx" ON "CampaignPlan"("sentAt");
CREATE INDEX IF NOT EXISTS "CampaignPlan_conversationId_idx" ON "CampaignPlan"("conversationId");
CREATE INDEX IF NOT EXISTS "CampaignPlan_createdAt_idx" ON "CampaignPlan"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContentDraft_conversationId_fkey'
  ) THEN
    ALTER TABLE "ContentDraft"
    ADD CONSTRAINT "ContentDraft_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "HermesConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContentDraft_messageId_fkey'
  ) THEN
    ALTER TABLE "ContentDraft"
    ADD CONSTRAINT "ContentDraft_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "HermesMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ContentDraft_campaignPlanId_fkey'
  ) THEN
    ALTER TABLE "ContentDraft"
    ADD CONSTRAINT "ContentDraft_campaignPlanId_fkey"
    FOREIGN KEY ("campaignPlanId") REFERENCES "CampaignPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CampaignPlan_conversationId_fkey'
  ) THEN
    ALTER TABLE "CampaignPlan"
    ADD CONSTRAINT "CampaignPlan_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "HermesConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

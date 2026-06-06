-- CreateTable
CREATE TABLE "HermesConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'workspace',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HermesConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HermesMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "module" TEXT,
    "model" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HermesMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HermesTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HermesTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "seoMeta" JSONB,
    "metadata" JSONB,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HermesConversation_channel_idx" ON "HermesConversation"("channel");

-- CreateIndex
CREATE INDEX "HermesConversation_status_idx" ON "HermesConversation"("status");

-- CreateIndex
CREATE INDEX "HermesConversation_createdAt_idx" ON "HermesConversation"("createdAt");

-- CreateIndex
CREATE INDEX "HermesMessage_conversationId_idx" ON "HermesMessage"("conversationId");

-- CreateIndex
CREATE INDEX "HermesMessage_createdAt_idx" ON "HermesMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HermesTemplate_name_key" ON "HermesTemplate"("name");

-- CreateIndex
CREATE INDEX "HermesTemplate_module_idx" ON "HermesTemplate"("module");

-- CreateIndex
CREATE INDEX "HermesTemplate_isActive_idx" ON "HermesTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ContentDraft_type_idx" ON "ContentDraft"("type");

-- CreateIndex
CREATE INDEX "ContentDraft_status_idx" ON "ContentDraft"("status");

-- CreateIndex
CREATE INDEX "ContentDraft_createdAt_idx" ON "ContentDraft"("createdAt");

-- AddForeignKey
ALTER TABLE "HermesMessage" ADD CONSTRAINT "HermesMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "HermesConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

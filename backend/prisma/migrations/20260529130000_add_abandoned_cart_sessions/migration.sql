-- CreateTable
CREATE TABLE "AbandonedCartSession" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convertedOrderId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedCartSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbandonedCartSession_lastSeenAt_idx" ON "AbandonedCartSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AbandonedCartSession_convertedAt_idx" ON "AbandonedCartSession"("convertedAt");

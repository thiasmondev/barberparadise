-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_email_productId_variantId_key" ON "StockAlert"("email", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_email_productId_null_variant_key" ON "StockAlert"("email", "productId") WHERE "variantId" IS NULL;

-- CreateIndex
CREATE INDEX "StockAlert_productId_variantId_notified_idx" ON "StockAlert"("productId", "variantId", "notified");

-- CreateIndex
CREATE INDEX "StockAlert_email_idx" ON "StockAlert"("email");

-- CreateIndex
CREATE INDEX "StockAlert_createdAt_idx" ON "StockAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

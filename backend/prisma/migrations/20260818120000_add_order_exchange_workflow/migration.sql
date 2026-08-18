-- CreateTable
CREATE TABLE "OrderExchange" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "returnedOrderItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "returnProductId" TEXT,
    "returnVariantId" TEXT,
    "returnVariantLabel" TEXT,
    "returnName" TEXT NOT NULL,
    "returnImage" TEXT NOT NULL DEFAULT '',
    "returnQuantity" INTEGER NOT NULL,
    "returnUnitPrice" DOUBLE PRECISION NOT NULL,
    "returnDiscountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnValue" DOUBLE PRECISION NOT NULL,
    "replacementProductId" TEXT NOT NULL,
    "replacementVariantId" TEXT,
    "replacementVariantLabel" TEXT,
    "replacementName" TEXT NOT NULL,
    "replacementImage" TEXT NOT NULL DEFAULT '',
    "replacementQuantity" INTEGER NOT NULL,
    "replacementUnitPrice" DOUBLE PRECISION NOT NULL,
    "replacementValue" DOUBLE PRECISION NOT NULL,
    "differenceAmount" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "priceTaxLabel" TEXT NOT NULL DEFAULT 'TTC',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "settlementMode" TEXT,
    "settlementStatus" TEXT NOT NULL DEFAULT 'not_required',
    "settlementPaymentId" TEXT,
    "settlementPaymentUrl" TEXT,
    "settlementRefundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "replacementStockReserved" BOOLEAN NOT NULL DEFAULT false,
    "replacementStockReleased" BOOLEAN NOT NULL DEFAULT false,
    "returnedStockRestored" BOOLEAN NOT NULL DEFAULT false,
    "initiatedBy" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnReceivedAt" TIMESTAMP(3),
    "settlementHandledAt" TIMESTAMP(3),
    "replacementShippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExchangeShipment" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "carrierShipmentId" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "packagingId" INTEGER,
    "totalWeightG" INTEGER,
    "offerId" TEXT,
    "serviceCode" TEXT,
    "deliveryMode" TEXT,
    "relayPointId" TEXT,
    "labelPriceCents" INTEGER,
    "labelCurrency" TEXT DEFAULT 'EUR',
    "insuranceValueCents" INTEGER,
    "labelPdfBase64" TEXT,
    "labelFormat" TEXT,
    "labelSource" TEXT,
    "labelStatus" TEXT,
    "labelGeneratedAt" TIMESTAMP(3),
    "carrierRawResponse" JSONB,
    "lastTrackingStatus" TEXT,
    "shippedAt" TIMESTAMP(3),
    "shippedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderExchangeShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExchangeEvent" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorEmail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderExchangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderExchange_settlementPaymentId_key" ON "OrderExchange"("settlementPaymentId");
CREATE INDEX "OrderExchange_orderId_status_idx" ON "OrderExchange"("orderId", "status");
CREATE INDEX "OrderExchange_returnedOrderItemId_idx" ON "OrderExchange"("returnedOrderItemId");
CREATE INDEX "OrderExchange_replacementProductId_idx" ON "OrderExchange"("replacementProductId");
CREATE INDEX "OrderExchange_replacementVariantId_idx" ON "OrderExchange"("replacementVariantId");
CREATE INDEX "OrderExchange_createdAt_idx" ON "OrderExchange"("createdAt");
CREATE UNIQUE INDEX "OrderExchangeShipment_exchangeId_direction_key" ON "OrderExchangeShipment"("exchangeId", "direction");
CREATE INDEX "OrderExchangeShipment_trackingNumber_idx" ON "OrderExchangeShipment"("trackingNumber");
CREATE INDEX "OrderExchangeShipment_carrier_idx" ON "OrderExchangeShipment"("carrier");
CREATE INDEX "OrderExchangeShipment_shippedAt_idx" ON "OrderExchangeShipment"("shippedAt");
CREATE INDEX "OrderExchangeEvent_exchangeId_createdAt_idx" ON "OrderExchangeEvent"("exchangeId", "createdAt");
CREATE INDEX "OrderExchangeEvent_type_idx" ON "OrderExchangeEvent"("type");

-- AddForeignKey
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_returnedOrderItemId_fkey" FOREIGN KEY ("returnedOrderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_returnProductId_fkey" FOREIGN KEY ("returnProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_returnVariantId_fkey" FOREIGN KEY ("returnVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_replacementProductId_fkey" FOREIGN KEY ("replacementProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderExchange" ADD CONSTRAINT "OrderExchange_replacementVariantId_fkey" FOREIGN KEY ("replacementVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderExchangeShipment" ADD CONSTRAINT "OrderExchangeShipment_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "OrderExchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderExchangeShipment" ADD CONSTRAINT "OrderExchangeShipment_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderExchangeEvent" ADD CONSTRAINT "OrderExchangeEvent_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "OrderExchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

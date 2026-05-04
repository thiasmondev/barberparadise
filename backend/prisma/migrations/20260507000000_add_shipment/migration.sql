-- Add shipment records for the logistics preparation MVP
CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "carrier" TEXT NOT NULL,
  "trackingNumber" TEXT,
  "packagingId" INTEGER,
  "totalWeightG" INTEGER,
  "shippedAt" TIMESTAMP(3),
  "shippedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");
CREATE INDEX "Shipment_carrier_idx" ON "Shipment"("carrier");
CREATE INDEX "Shipment_shippedAt_idx" ON "Shipment"("shippedAt");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;

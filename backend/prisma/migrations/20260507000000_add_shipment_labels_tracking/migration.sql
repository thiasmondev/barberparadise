-- Add official label, fallback label, and tracking metadata to shipments
ALTER TABLE "Shipment" ADD COLUMN "carrierShipmentId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "trackingUrl" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "labelPdfBase64" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "labelFormat" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "labelSource" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "labelStatus" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "labelGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "carrierRawResponse" JSONB;
ALTER TABLE "Shipment" ADD COLUMN "lastTrackingStatus" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "lastTrackingSyncAt" TIMESTAMP(3);

CREATE INDEX "Shipment_labelStatus_idx" ON "Shipment"("labelStatus");

-- AlterTable: add manual tracking fields to Shipment
ALTER TABLE "Shipment" ADD COLUMN "manualTrackingNumber" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "manualCarrier" TEXT;

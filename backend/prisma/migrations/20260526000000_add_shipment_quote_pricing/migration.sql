-- Persist official carrier quote, pricing, insurance and relay-point metadata on shipments.
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "offerId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "serviceCode" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "deliveryMode" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "relayPointId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "labelPriceCents" INTEGER;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "labelCurrency" TEXT DEFAULT 'EUR';
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "insuranceValueCents" INTEGER;
CREATE INDEX IF NOT EXISTS "Shipment_offerId_idx" ON "Shipment"("offerId");

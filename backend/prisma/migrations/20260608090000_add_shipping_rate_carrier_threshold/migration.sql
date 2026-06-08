ALTER TABLE "ShippingRate" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "ShippingRate" ADD COLUMN IF NOT EXISTS "freeThreshold" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "ShippingRate_carrier_idx" ON "ShippingRate"("carrier");

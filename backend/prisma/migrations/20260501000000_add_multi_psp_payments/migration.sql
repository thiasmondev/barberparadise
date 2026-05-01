-- Add multi-PSP payment metadata to orders while preserving existing rows.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalHT" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalTTC" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingAddress" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isB2B" BOOLEAN NOT NULL DEFAULT false;

-- Keep new accounting fields coherent for historical orders.
UPDATE "Order"
SET
  "totalTTC" = CASE WHEN "totalTTC" = 0 THEN "total" ELSE "totalTTC" END,
  "vatAmount" = CASE WHEN "vatAmount" = 0 THEN ROUND(("total" - ("total" / 1.2))::numeric, 2)::double precision ELSE "vatAmount" END,
  "totalHT" = CASE WHEN "totalHT" = 0 THEN ROUND(("total" / 1.2)::numeric, 2)::double precision ELSE "totalHT" END,
  "customerEmail" = COALESCE("customerEmail", "email");

-- Extend shipping addresses with checkout complement and phone fields.
ALTER TABLE "ShippingAddress" ADD COLUMN IF NOT EXISTS "extension" TEXT DEFAULT '';
ALTER TABLE "ShippingAddress" ADD COLUMN IF NOT EXISTS "phone" TEXT DEFAULT '';

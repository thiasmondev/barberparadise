-- Add VAT number storage for B2B EU checkout orders.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;

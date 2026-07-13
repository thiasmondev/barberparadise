-- Migration: add commercialDiscountAmount and commercialDiscountLabel to Order
-- Applied automatically by prisma migrate deploy on Render deployment

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "commercialDiscountAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "commercialDiscountLabel" TEXT;

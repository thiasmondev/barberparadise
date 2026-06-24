-- AlterTable: add relay point fields to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "relayPointId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "relayPointName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "relayPointAddress" TEXT;

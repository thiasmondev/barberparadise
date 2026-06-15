-- Add POS / Caisse support to Barber Paradise orders.
-- This migration is intentionally additive and idempotent where PostgreSQL allows it.

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS "terminalId" TEXT,
  ADD COLUMN IF NOT EXISTS "posSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "posPaymentStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "posPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "posCashierId" TEXT,
  ADD COLUMN IF NOT EXISTS "posCashierEmail" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "variantId" TEXT,
  ADD COLUMN IF NOT EXISTS "variantLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isCustomSale" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "PosSession" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "terminalId" TEXT NOT NULL,
  "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Order_channel_idx" ON "Order"("channel");
CREATE INDEX IF NOT EXISTS "Order_terminalId_idx" ON "Order"("terminalId");
CREATE INDEX IF NOT EXISTS "Order_posSessionId_idx" ON "Order"("posSessionId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE INDEX IF NOT EXISTS "PosSession_adminId_idx" ON "PosSession"("adminId");
CREATE INDEX IF NOT EXISTS "PosSession_terminalId_idx" ON "PosSession"("terminalId");
CREATE INDEX IF NOT EXISTS "PosSession_openedAt_idx" ON "PosSession"("openedAt");
CREATE INDEX IF NOT EXISTS "PosSession_closedAt_idx" ON "PosSession"("closedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_posSessionId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_posSessionId_fkey"
      FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_variantId_fkey'
  ) THEN
    ALTER TABLE "OrderItem"
      ADD CONSTRAINT "OrderItem_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PosSession_adminId_fkey'
  ) THEN
    ALTER TABLE "PosSession"
      ADD CONSTRAINT "PosSession_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

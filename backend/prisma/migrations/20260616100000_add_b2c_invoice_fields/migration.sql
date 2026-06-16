-- Add B2C invoice metadata on orders
ALTER TABLE "Order" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "invoiceUrl" TEXT;

CREATE INDEX "Order_invoiceNumber_idx" ON "Order"("invoiceNumber");

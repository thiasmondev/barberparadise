-- Ajout des remises par ligne et globales pour les brouillons admin et le POS
ALTER TABLE "Order" ADD COLUMN "orderDiscountType" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderDiscountValue" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem" ADD COLUMN "lineDiscountType" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "lineDiscountValue" DOUBLE PRECISION;

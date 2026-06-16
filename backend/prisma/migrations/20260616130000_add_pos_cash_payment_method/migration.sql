-- Normalize payment methods for POS cash/card support and enforce a default.
UPDATE "Order"
SET "paymentMethod" = 'card'
WHERE "paymentMethod" IS NULL OR "paymentMethod" = '' OR "paymentMethod" = 'pointofsale';

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'card';
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET NOT NULL;

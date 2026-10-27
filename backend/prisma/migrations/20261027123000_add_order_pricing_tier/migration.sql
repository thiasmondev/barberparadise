-- Preserve every historical order as unknown/legacy by leaving this column NULL.
-- New order creation paths explicitly choose pro or retail.
CREATE TYPE "PricingTier" AS ENUM ('pro', 'retail');

ALTER TABLE "Order"
ADD COLUMN "pricingTier" "PricingTier";

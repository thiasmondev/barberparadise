-- POS exchanges can now explicitly be fulfilled in store or shipped.  Existing
-- historical POS exchanges retain their in-store semantics; all other existing
-- exchanges keep the shipping workflow they already used.
ALTER TABLE "OrderExchange"
  ADD COLUMN "fulfillmentMode" TEXT NOT NULL DEFAULT 'shipment',
  ADD COLUMN "deliveryMode" TEXT,
  ADD COLUMN "shippingAddressSnapshot" JSONB,
  ADD COLUMN "relayPointSnapshot" JSONB,
  ADD COLUMN "settlementManualPayment" JSONB;

ALTER TABLE "OrderExchangeShipment"
  ADD COLUMN "relayPointSnapshot" JSONB;

UPDATE "OrderExchange" AS exchange
SET "fulfillmentMode" = 'in_store'
FROM "Order" AS source_order
WHERE source_order."id" = exchange."orderId"
  AND source_order."channel" = 'pos';

CREATE INDEX "OrderExchange_fulfillmentMode_idx" ON "OrderExchange"("fulfillmentMode");

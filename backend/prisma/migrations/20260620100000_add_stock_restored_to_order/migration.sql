-- AlterTable: add stockRestored flag to Order
-- Used to guarantee idempotence when restoring stock on cancellation or deletion.
-- Default false so existing orders are not affected.
ALTER TABLE "Order" ADD COLUMN "stockRestored" BOOLEAN NOT NULL DEFAULT false;

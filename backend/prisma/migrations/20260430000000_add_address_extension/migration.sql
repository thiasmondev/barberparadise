-- Add optional address extension/complement field for customer addresses.
ALTER TABLE "Address" ADD COLUMN "extension" TEXT DEFAULT '';

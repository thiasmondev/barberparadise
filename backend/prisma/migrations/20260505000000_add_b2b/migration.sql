-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "priceProEur" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "proInvoiceNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "proInvoiceUrl" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "siret" TEXT,
    "vatNumber" TEXT,
    "activity" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProAccount_customerId_key" ON "ProAccount"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProAccount_status_idx" ON "ProAccount"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProAccount_createdAt_idx" ON "ProAccount"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProAccount_customerId_fkey'
    ) THEN
        ALTER TABLE "ProAccount" ADD CONSTRAINT "ProAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

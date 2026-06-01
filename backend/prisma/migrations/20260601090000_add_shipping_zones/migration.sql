-- CreateTable
CREATE TABLE IF NOT EXISTS "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShippingRate" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxAmount" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "deliveryTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShippingZone_name_idx" ON "ShippingZone"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShippingRate_zoneId_idx" ON "ShippingRate"("zoneId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShippingRate_minAmount_idx" ON "ShippingRate"("minAmount");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShippingRate_zoneId_fkey'
  ) THEN
    ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

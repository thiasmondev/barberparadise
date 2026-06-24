-- CreateTable: CustomerEmail — emails secondaires d'un client (facturation, comptabilité, direction...)
CREATE TABLE "CustomerEmail" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Secondaire',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerEmail_customerId_email_key" ON "CustomerEmail"("customerId", "email");

-- CreateIndex
CREATE INDEX "CustomerEmail_customerId_idx" ON "CustomerEmail"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerEmail" ADD CONSTRAINT "CustomerEmail_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

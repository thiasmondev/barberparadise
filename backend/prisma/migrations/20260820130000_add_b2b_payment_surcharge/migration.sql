-- Frais de paiement B2B persistés lors de l'initiation du paiement.
-- Les valeurs par défaut à zéro préservent intégralement les commandes historiques.
ALTER TABLE "Order"
  ADD COLUMN "paymentFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentFeeHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentFeeVatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentFeeVatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentFeeTTC" DOUBLE PRECISION NOT NULL DEFAULT 0;

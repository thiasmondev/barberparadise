-- Migration : ajout des champs d'échéance de paiement et de relances automatiques
-- Date : 2026-07-13
-- Auteur : admin

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentDueDate" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentReminderStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "lastPaymentReminderAt" TIMESTAMP(3);

-- Index pour les requêtes du job de relance quotidien
CREATE INDEX IF NOT EXISTS "Order_paymentDueDate_idx" ON "Order"("paymentDueDate");

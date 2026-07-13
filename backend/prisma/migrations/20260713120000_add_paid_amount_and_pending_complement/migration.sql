-- AlterTable: Ajout des champs paidAmount, pendingComplementAmount et pendingComplementPaymentId sur Order
-- paidAmount : montant réellement encaissé (paiement initial + compléments confirmés via webhook)
-- pendingComplementAmount : montant du complément en attente (lien Mollie envoyé, non encore payé)
-- pendingComplementPaymentId : ID du paiement Mollie du complément en attente

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pendingComplementAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pendingComplementPaymentId" TEXT;

-- Backfill : pour les commandes déjà payées, paidAmount = total (approximation correcte pour l'historique)
-- Les commandes avec statut 'paid', 'processing', 'shipped', 'delivered' ont paidAmount = total
UPDATE "Order" SET "paidAmount" = "total"
WHERE "status" IN ('paid', 'processing', 'shipped', 'delivered', 'partially_refunded', 'refunded');

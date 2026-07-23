-- AlterTable: ajouter posPaymentBreakdown pour la répartition paiement divisé POS
ALTER TABLE "Order" ADD COLUMN "posPaymentBreakdown" JSONB;

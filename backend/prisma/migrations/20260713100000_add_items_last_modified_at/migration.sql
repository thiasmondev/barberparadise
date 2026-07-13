-- AlterTable: Ajouter le champ itemsLastModifiedAt sur la table Order
-- Ce champ est mis à jour à chaque modification des articles d'une commande payée
-- Il permet d'afficher un badge "Facture à régénérer" si la facture est antérieure à cette date
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "itemsLastModifiedAt" TIMESTAMP(3);

-- Ajoute les champs de prix remisé et prix d'achat confidentiel au catalogue produit.
ALTER TABLE "Product" ADD COLUMN "compareAtPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "purchasePrice" DOUBLE PRECISION;

-- Reprise de compatibilité : les anciens prix barrés stockés dans originalPrice
-- alimentent compareAtPrice afin que les promotions existantes restent pilotées par le nouveau champ.
UPDATE "Product"
SET "compareAtPrice" = "originalPrice"
WHERE "originalPrice" IS NOT NULL;

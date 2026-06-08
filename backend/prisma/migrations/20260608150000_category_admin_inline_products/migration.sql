-- Ajout des champs nécessaires à la fiche catégorie admin et à l'ordre inline des produits.
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "metaTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "metaDescription" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "categoryOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Product_categoryOrder_idx" ON "Product"("categoryOrder");

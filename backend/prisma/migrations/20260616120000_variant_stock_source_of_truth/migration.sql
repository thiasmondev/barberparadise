-- Les produits ayant au moins une variante ne doivent plus tirer leur disponibilité du stock parent.
-- Le champ stockCount reste non nullable dans le schéma actuel ; il est neutralisé à 0 et ignoré en lecture.
UPDATE "Product" p
SET
  "stockCount" = 0,
  "inStock" = EXISTS (
    SELECT 1
    FROM "ProductVariant" v
    WHERE v."productId" = p."id"
      AND v."inStock" = TRUE
      AND v."stock" > 0
  )
WHERE EXISTS (
  SELECT 1
  FROM "ProductVariant" v
  WHERE v."productId" = p."id"
);

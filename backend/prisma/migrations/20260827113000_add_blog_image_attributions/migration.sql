-- Métadonnées d’attribution des images libres de droit insérées dans les articles Blog.
-- Nullable afin de préserver sans changement les articles existants et les images IA.
ALTER TABLE "BlogArticle" ADD COLUMN "imageAttributions" JSONB;

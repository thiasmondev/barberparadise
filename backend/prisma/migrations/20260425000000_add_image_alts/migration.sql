-- AlterTable: add imageAlts column to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageAlts" TEXT NOT NULL DEFAULT '[]';

/**
 * Route admin : POST /api/admin/import-reviews
 * Upload d'un CSV Judge.me et import dans la table Review.
 * Protégée par requireAdmin.
 */

import { Router, Response } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Multer : stockage en mémoire (pas de fichier sur disque)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers CSV sont acceptés"));
    }
  },
});

interface JudgeMeRow {
  title: string;
  body: string;
  rating: string;
  review_date: string;
  reviewer_name: string;
  reviewer_email: string;
  product_handle: string;
  product_id: string;
  [key: string]: string;
}

interface UnmatchedReview {
  reviewer_name: string;
  reviewer_email: string;
  rating: number;
  title: string;
  body: string;
  review_date: string;
  product_handle: string;
  product_id: string;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_\s]+/g, "")
    .trim();
}

// POST /api/admin/import-reviews
router.post(
  "/",
  requireAdmin,
  upload.single("csv"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier CSV fourni" });
      return;
    }

    try {
      const raw = req.file.buffer.toString("utf-8");

      const rows: JudgeMeRow[] = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      // Charger tous les produits
      const products = await prisma.product.findMany({
        select: { id: true, handle: true, slug: true, name: true },
      });

      const byHandle = new Map<string, string>();
      const bySlug = new Map<string, string>();

      for (const p of products) {
        byHandle.set(normalize(p.handle), p.id);
        bySlug.set(normalize(p.slug), p.id);
      }

      let imported = 0;
      let skipped = 0;
      const unmatched: UnmatchedReview[] = [];

      for (const row of rows) {
        const rating = parseInt(row.rating, 10);
        if (isNaN(rating) || rating < 1 || rating > 5) {
          skipped++;
          continue;
        }

        // Matching produit
        const handleNorm = normalize(row.product_handle || "");
        let productId = byHandle.get(handleNorm) || bySlug.get(handleNorm);

        // Fallback : matching partiel
        if (!productId && handleNorm) {
          for (const [slugNorm, pid] of bySlug.entries()) {
            if (slugNorm.includes(handleNorm) || handleNorm.includes(slugNorm)) {
              productId = pid;
              break;
            }
          }
        }

        if (!productId) {
          unmatched.push({
            reviewer_name: row.reviewer_name,
            reviewer_email: row.reviewer_email,
            rating,
            title: row.title || "",
            body: row.body || "",
            review_date: row.review_date,
            product_handle: row.product_handle,
            product_id: row.product_id,
          });
          continue;
        }

        // Dédupliquation
        const reviewDate = new Date(row.review_date);
        const existing = await prisma.review.findFirst({
          where: {
            productId,
            email: row.reviewer_email || undefined,
            rating,
            createdAt: reviewDate,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        const comment = [row.title, row.body].filter(Boolean).join(" — ") || "(sans commentaire)";

        await prisma.review.create({
          data: {
            productId,
            author: row.reviewer_name || "Client vérifié",
            email: row.reviewer_email || null,
            rating,
            comment,
            verified: true,
            approved: true,
            createdAt: reviewDate,
          },
        });

        imported++;
      }

      res.json({
        success: true,
        total: rows.length,
        imported,
        skipped,
        unmatched: unmatched.length,
        unmatchedList: unmatched,
      });
    } catch (err: unknown) {
      console.error("Erreur import reviews:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Erreur interne",
      });
    }
  }
);

export default router;

/**
 * scripts/import-reviews.ts
 *
 * Importe les avis Judge.me (export CSV Shopify) dans la table Review PostgreSQL.
 *
 * Usage :
 *   npx ts-node scripts/import-reviews.ts <chemin-vers-le-csv>
 *
 * Par défaut, cherche le CSV dans scripts/reviews.csv si aucun argument n'est fourni.
 *
 * Les avis sans produit correspondant sont logués dans scripts/unmatched-reviews.json.
 */

import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface JudgeMeRow {
  title: string;
  body: string;
  rating: string;
  review_date: string;
  source: string;
  curated: string;
  reviewer_name: string;
  reviewer_email: string;
  product_id: string;
  product_handle: string;
  reply: string;
  reply_date: string;
  picture_urls: string;
  ip_address: string;
  location: string;
  metaobject_handle: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise une chaîne pour la comparaison : minuscules, sans accents, sans tirets/espaces.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_\s]+/g, "")
    .trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = process.argv[2] || path.join(__dirname, "reviews.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`❌  Fichier CSV introuvable : ${csvPath}`);
    console.error(`    Usage : npx ts-node scripts/import-reviews.ts <chemin-vers-le-csv>`);
    process.exit(1);
  }

  console.log(`\n📂  Lecture du CSV : ${csvPath}`);
  const raw = fs.readFileSync(csvPath, "utf-8");

  const rows: JudgeMeRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  });

  console.log(`📊  ${rows.length} avis trouvés dans le CSV\n`);

  // ─── Charger tous les produits en base ──────────────────────────────────────
  const products = await prisma.product.findMany({
    select: { id: true, handle: true, slug: true, name: true },
  });

  // Construire des maps pour le matching rapide
  const byHandle = new Map<string, string>(); // handle normalisé → productId
  const bySlug = new Map<string, string>();   // slug normalisé → productId
  const byName = new Map<string, string>();   // name normalisé → productId

  for (const p of products) {
    byHandle.set(normalize(p.handle), p.id);
    bySlug.set(normalize(p.slug), p.id);
    byName.set(normalize(p.name), p.id);
  }

  console.log(`🗄️   ${products.length} produits chargés depuis la base\n`);

  // ─── Vérifier les avis déjà importés (dédupliquation par metaobject_handle) ─
  // On stocke le metaobject_handle dans le champ `comment` avec un préfixe spécial
  // pour éviter les doublons lors de ré-exécutions.
  // Plus propre : on vérifie via email + productId + rating + date.

  let imported = 0;
  let skipped = 0;
  let unmatched = 0;
  const unmatchedList: UnmatchedReview[] = [];

  for (const row of rows) {
    const rating = parseInt(row.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      console.warn(`⚠️   Note invalide pour ${row.reviewer_name} : "${row.rating}" — ignoré`);
      skipped++;
      continue;
    }

    // ─── Matching produit ────────────────────────────────────────────────────
    const handleNorm = normalize(row.product_handle);
    let productId = byHandle.get(handleNorm) || bySlug.get(handleNorm);

    // Fallback : matching par mots-clés du handle dans les noms de produits
    if (!productId && row.product_handle) {
      // Essayer de trouver un produit dont le slug contient le handle Shopify
      for (const [slugNorm, pid] of bySlug.entries()) {
        if (slugNorm.includes(handleNorm) || handleNorm.includes(slugNorm)) {
          productId = pid;
          break;
        }
      }
    }

    if (!productId) {
      console.warn(`❌  Produit non trouvé pour handle "${row.product_handle}" (${row.reviewer_name})`);
      unmatchedList.push({
        reviewer_name: row.reviewer_name,
        reviewer_email: row.reviewer_email,
        rating,
        title: row.title || "",
        body: row.body || "",
        review_date: row.review_date,
        product_handle: row.product_handle,
        product_id: row.product_id,
      });
      unmatched++;
      continue;
    }

    // ─── Dédupliquation : même email + productId + rating + date ────────────
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
      console.log(`⏭️   Déjà importé : ${row.reviewer_name} → ${row.product_handle}`);
      skipped++;
      continue;
    }

    // ─── Créer l'avis ────────────────────────────────────────────────────────
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

    console.log(`✅  Importé : ${row.reviewer_name} (${rating}★) → ${row.product_handle}`);
    imported++;
  }

  // ─── Rapport final ────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📈  RÉSULTAT DE L'IMPORT`);
  console.log(`${"─".repeat(60)}`);
  console.log(`✅  Importés    : ${imported}`);
  console.log(`⏭️   Ignorés     : ${skipped} (déjà en base ou note invalide)`);
  console.log(`❌  Non matchés : ${unmatched}`);
  console.log(`${"─".repeat(60)}\n`);

  if (unmatchedList.length > 0) {
    const outputPath = path.join(__dirname, "unmatched-reviews.json");
    fs.writeFileSync(outputPath, JSON.stringify(unmatchedList, null, 2), "utf-8");
    console.log(`📄  Avis non matchés sauvegardés dans : ${outputPath}`);
    console.log(`    Vérifiez ce fichier pour les associer manuellement.\n`);
  }
}

main()
  .catch((err) => {
    console.error("Erreur fatale :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

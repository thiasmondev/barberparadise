/**
 * seed-brands.ts
 * ─────────────────────────────────────────────────────────────
 * 1. Récupère les marques distinctes depuis Product
 * 2. Génère une description via OpenAI (compatible Anthropic)
 * 3. Tente de scraper le logo depuis barberparadise.fr
 * 4. Insère chaque Brand en base
 * 5. Met à jour brandId dans tous les produits correspondants
 * ─────────────────────────────────────────────────────────────
 * Usage: npx ts-node scripts/seed-brands.ts
 */

import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import * as https from "https";
import * as http from "http";

const prisma = new PrismaClient();

// ─── OpenAI / Claude via proxy Manus ─────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
});

// ─── Slugify ──────────────────────────────────────────────────
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // supprimer accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Générer description via LLM ─────────────────────────────
async function generateDescription(brandName: string): Promise<string> {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en matériel de barbier et coiffure professionnelle. Rédige des descriptions de marques courtes, professionnelles et percutantes en français.",
        },
        {
          role: "user",
          content: `Rédige une description courte de 2 à 3 phrases pour la marque "${brandName}" dans le contexte du barbier et de la coiffure professionnelle. Mets en avant la réputation, la spécialité ou les produits phares de la marque. Sois factuel et professionnel. Réponds uniquement avec la description, sans titre ni formatage.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error(`  ⚠ LLM error for ${brandName}:`, err);
    return "";
  }
}

// ─── Scraper logo depuis barberparadise.fr ────────────────────
function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BarberParadiseSeedBot/1.0)",
        },
      },
      (res) => {
        // Suivre les redirections
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchUrl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function scrapeLogo(brandName: string, slug: string): Promise<string | null> {
  // Essayer différents slugs Shopify
  const slugsToTry = [
    slug,
    brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    brandName.toLowerCase().replace(/\s+/g, "-"),
  ];

  for (const s of slugsToTry) {
    try {
      const url = `https://www.barberparadise.fr/collections/${s}`;
      const html = await fetchUrl(url);

      // Chercher l'image de collection (og:image ou image principale)
      const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
      if (ogMatch) {
        const imgUrl = ogMatch[1].startsWith("//")
          ? "https:" + ogMatch[1]
          : ogMatch[1];
        // Filtrer les images génériques du site
        if (!imgUrl.includes("barberparadise.fr/files/") && imgUrl.includes("cdn.shopify")) {
          return imgUrl;
        }
      }

      // Chercher une image de collection dans le HTML
      const collectionImgMatch = html.match(
        /class="[^"]*collection[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i
      );
      if (collectionImgMatch) {
        const imgUrl = collectionImgMatch[1].startsWith("//")
          ? "https:" + collectionImgMatch[1]
          : collectionImgMatch[1];
        return imgUrl;
      }
    } catch {
      // Continuer avec le slug suivant
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Seed Brands — Barber Paradise\n");

  // 1. Récupérer les marques distinctes
  const rawBrands = await prisma.product.findMany({
    select: { brand: true },
    distinct: ["brand"],
    where: { brand: { not: "" } },
    orderBy: { brand: "asc" },
  });

  const brandNames = rawBrands.map((b) => b.brand).filter(Boolean);
  console.log(`📦 ${brandNames.length} marques distinctes trouvées\n`);

  let withLogo = 0;
  let withoutLogo = 0;
  const results: { name: string; slug: string; hasLogo: boolean; hasDesc: boolean }[] = [];

  for (const brandName of brandNames) {
    const slug = slugify(brandName);
    console.log(`⚙  Traitement: ${brandName} (slug: ${slug})`);

    // Vérifier si la marque existe déjà
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      console.log(`   ✓ Déjà en base (id: ${existing.id})\n`);
      // Mettre à jour les produits quand même
      await prisma.product.updateMany({
        where: { brand: brandName },
        data: { brandId: existing.id },
      });
      results.push({ name: brandName, slug, hasLogo: !!existing.logo, hasDesc: !!existing.description });
      if (existing.logo) withLogo++; else withoutLogo++;
      continue;
    }

    // 2. Générer description
    console.log(`   📝 Génération description...`);
    const description = await generateDescription(brandName);
    if (description) console.log(`   ✓ Description: "${description.substring(0, 60)}..."`);

    // 3. Scraper logo
    console.log(`   🖼  Scraping logo...`);
    const logo = await scrapeLogo(brandName, slug);
    if (logo) {
      console.log(`   ✓ Logo trouvé: ${logo.substring(0, 60)}...`);
      withLogo++;
    } else {
      console.log(`   ✗ Pas de logo trouvé`);
      withoutLogo++;
    }

    // 4. Insérer la marque
    const brand = await prisma.brand.create({
      data: {
        name: brandName,
        slug,
        description: description || null,
        logo: logo || null,
      },
    });
    console.log(`   ✅ Brand créée (id: ${brand.id})\n`);

    // 5. Mettre à jour brandId dans les produits
    const updated = await prisma.product.updateMany({
      where: { brand: brandName },
      data: { brandId: brand.id },
    });
    console.log(`   🔗 ${updated.count} produits liés\n`);

    results.push({ name: brandName, slug, hasLogo: !!logo, hasDesc: !!description });

    // Pause pour ne pas surcharger l'API LLM
    await new Promise((r) => setTimeout(r, 500));
  }

  // ─── Rapport final ────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("📊 RAPPORT FINAL");
  console.log("═".repeat(60));
  console.log(`Total marques créées : ${results.length}`);
  console.log(`Avec logo            : ${withLogo}`);
  console.log(`Sans logo            : ${withoutLogo}`);
  console.log("\nDétail :");
  for (const r of results) {
    const logo = r.hasLogo ? "🖼 " : "  ";
    const desc = r.hasDesc ? "📝" : "  ";
    console.log(`  ${logo}${desc} ${r.name} → /${r.slug}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

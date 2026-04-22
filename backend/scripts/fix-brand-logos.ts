/**
 * fix-brand-logos.ts
 * ─────────────────────────────────────────────────────────────
 * Pour chaque marque :
 *  1. Scrape le site officiel pour trouver l'URL du logo
 *  2. Télécharge le logo en local
 *  3. L'uploade sur Cloudinary (dossier barberparadise/brands)
 *  4. Met à jour Brand.logo + Brand.website via Prisma
 *
 * Usage (depuis le Shell Render) :
 *   npx ts-node scripts/fix-brand-logos.ts
 *
 * Variables d'environnement requises :
 *   DATABASE_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * ─────────────────────────────────────────────────────────────
 */

import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const prisma = new PrismaClient();

// ─── Config Cloudinary ────────────────────────────────────────
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const API_KEY    = process.env.CLOUDINARY_API_KEY    || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

console.log("\n🔧 Variables Cloudinary lues depuis process.env :");
console.log(`   CLOUDINARY_CLOUD_NAME : ${CLOUD_NAME  ? CLOUD_NAME              : "❌ NON DÉFINIE"}`);
console.log(`   CLOUDINARY_API_KEY    : ${API_KEY     ? API_KEY.slice(0, 6) + "..." : "❌ NON DÉFINIE"}`);
console.log(`   CLOUDINARY_API_SECRET : ${API_SECRET  ? API_SECRET.slice(0, 4) + "..." : "❌ NON DÉFINIE"}`);

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error("\n❌ Variables Cloudinary manquantes — vérifier les env vars Render.");
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key:    API_KEY,
  api_secret: API_SECRET,
  secure:     true,
});

// ─── Liste des marques avec leur site officiel ────────────────
const brands = [
  { slug: "andis",                    url: "https://www.andis.com" },
  { slug: "babyliss-pro",             url: "https://www.babylisspro.com" },
  { slug: "wahl",                     url: "https://www.wahl.com" },
  { slug: "jrl",                      url: "https://jrlprofessional.com" },
  { slug: "gamma",                    url: "https://www.gamma-piu.com" },
  { slug: "hey-joe",                  url: "https://heyjoe.es" },
  { slug: "king-brown",               url: "https://kingbrownpomade.com" },
  { slug: "dr-k-soap",                url: "https://dr-k-soap.com" },
  { slug: "denman",                   url: "https://www.denmanbrush.com" },
  { slug: "hercules-sagemann",        url: "https://www.hercules-saegemann.de" },
  { slug: "lockhart-s",               url: "https://lockhartspomade.com" },
  { slug: "l3vel3",                   url: "https://l3vel3.com" },
  { slug: "style-craft",              url: "https://stylecraftofficial.com" },
  { slug: "clubman-pinaud",           url: "https://clubman.com" },
  { slug: "vitos",                    url: "https://www.vitos.it" },
  { slug: "omega",                    url: "https://www.omegashaving.com" },
  { slug: "fatip",                    url: "https://www.fatip.it" },
  { slug: "euromax",                  url: "https://www.euromaxgroup.nl" },
  { slug: "panasonic",                url: "https://www.panasonic.com" },
  { slug: "osaka",                    url: "https://ciseaux-osaka.fr" },
  { slug: "barber-paradise",          url: "https://www.barberparadise.fr" },
  { slug: "jacques-seban",            url: "https://www.jacques-seban.com" },
  { slug: "disicide",                 url: "https://disicide.com" },
  { slug: "trimmercide",              url: "https://disicide.com/product-category/trimmercide/" },
  { slug: "dauntless-modern-grooming",url: "https://dauntlessgrooming.com" },
  { slug: "beubar",                   url: "https://www.barberparadise.fr/collections/beubar" },
  { slug: "dandy",                    url: "https://www.barberparadise.fr/collections/dandy" },
  { slug: "haircut",                  url: "https://www.jacques-seban.com/marque/10-haircut" },
  { slug: "echosline",                url: "https://www.echosline.it" },
  { slug: "derby",                    url: "https://www.derbypremium.com" },
  { slug: "y-s-park",                 url: "https://yspark.com" },
];

// ─── Utilitaires ──────────────────────────────────────────────

/** Nettoyer une URL relative en URL absolue */
function toAbsolute(src: string, baseUrl: string): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return "";
  }
}

/** Récupérer le HTML d'une URL avec timeout et User-Agent */
function fetchHtml(url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const timer = setTimeout(() => reject(new Error(`Timeout ${url}`)), timeoutMs);

    const req = protocol.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (res) => {
        clearTimeout(timer);
        // Suivre les redirections (max 3)
        if (
          (res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 307 ||
            res.statusCode === 308) &&
          res.headers.location
        ) {
          const redirectUrl = toAbsolute(res.headers.location, url);
          fetchHtml(redirectUrl, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
          return;
        }
        let html = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (html += chunk));
        res.on("end", () => resolve(html));
        res.on("error", reject);
      }
    );
    req.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Extraire l'URL du logo depuis le HTML */
function extractLogoUrl(html: string, baseUrl: string): string | null {
  // Stratégies par ordre de priorité

  // 1. Balise <link rel="icon"> ou <link rel="apple-touch-icon"> haute résolution (non utilisé pour logo)
  // 2. <img> avec "logo" dans src, class ou alt — dans le header ou nav
  const patterns = [
    // img avec logo dans le src
    /<img[^>]+src=["']([^"']+logo[^"']*\.(png|jpg|jpeg|webp|svg))["'][^>]*>/gi,
    // img avec logo dans la class
    /<img[^>]+class=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["'][^>]*>/gi,
    // img avec logo dans l'alt
    /<img[^>]+alt=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["'][^>]*>/gi,
    // img avec logo dans l'id
    /<img[^>]+id=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["'][^>]*>/gi,
    // src avec logo dans le chemin (sans balise img complète)
    /src=["']([^"']*(?:logo|brand|marque)[^"']*\.(png|jpg|jpeg|webp|svg))["']/gi,
    // Shopify CDN : ui-*-logo ou *-logo-*
    /src=["']((?:https?:)?\/\/[^"']*(?:logo|brand)[^"']*\.(png|jpg|jpeg|webp|svg)[^"']*)["']/gi,
    // Open Graph image (og:image) — souvent le logo
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(html);
    if (match) {
      const src = match[1];
      if (src && !src.includes("favicon") && !src.includes("icon-")) {
        const abs = toAbsolute(src, baseUrl);
        if (abs) return abs;
      }
    }
  }

  // Fallback : première image dans le <header> ou <nav>
  const headerMatch = html.match(/<(?:header|nav)[^>]*>([\s\S]{0,3000}?)<\/(?:header|nav)>/i);
  if (headerMatch) {
    const headerHtml = headerMatch[1];
    const imgMatch = headerHtml.match(/src=["']([^"']+\.(png|jpg|jpeg|webp|svg))["']/i);
    if (imgMatch) {
      const abs = toAbsolute(imgMatch[1], baseUrl);
      if (abs && !abs.includes("favicon")) return abs;
    }
  }

  return null;
}

/** Télécharger une image vers un fichier temporaire */
function downloadImage(url: string, destPath: string, depth = 0): Promise<void> {
  if (depth > 3) return Promise.reject(new Error("Trop de redirections"));
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    const timer = setTimeout(() => {
      file.close();
      reject(new Error(`Timeout téléchargement ${url}`));
    }, 15000);

    protocol
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        clearTimeout(timer);
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          res.headers.location
        ) {
          file.close();
          const redirectUrl = toAbsolute(res.headers.location, url);
          downloadImage(redirectUrl, destPath, depth + 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      })
      .on("error", (err) => { clearTimeout(timer); file.close(); reject(err); });
  });
}

/** Traiter une marque : scrape → download → cloudinary → prisma */
async function processBrand(
  slug: string,
  siteUrl: string
): Promise<{ slug: string; status: "ok" | "skip" | "error"; logoUrl?: string; error?: string }> {
  const tmpPath = path.join(os.tmpdir(), `brand-logo-${slug}.tmp`);

  try {
    // 1. Scraper le HTML
    const html = await fetchHtml(siteUrl);

    // 2. Extraire l'URL du logo
    const logoUrl = extractLogoUrl(html, siteUrl);
    if (!logoUrl) {
      return { slug, status: "skip", error: "Logo non trouvé dans le HTML" };
    }

    // 3. Télécharger le logo
    await downloadImage(logoUrl, tmpPath);
    const size = fs.statSync(tmpPath).size;
    if (size < 100) {
      fs.unlinkSync(tmpPath);
      return { slug, status: "skip", error: `Image trop petite (${size} octets)` };
    }

    // 4. Uploader sur Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tmpPath, {
      folder: "barberparadise/brands",
      public_id: `${slug}-logo`,
      overwrite: true,
      resource_type: "image",
      transformation: [
        { width: 400, height: 400, crop: "fit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
    const cloudinaryUrl = uploadResult.secure_url;

    // 5. Nettoyer le fichier temporaire
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

    // 6. Mettre à jour en base via Prisma
    await prisma.brand.update({
      where: { slug },
      data: {
        logo:    cloudinaryUrl,
        website: siteUrl.replace(/\/collections\/.*$/, "").replace(/\/marque\/.*$/, "").replace(/\/product-category\/.*$/, ""),
      },
    });

    return { slug, status: "ok", logoUrl: cloudinaryUrl };
  } catch (err: any) {
    if (fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath); } catch {} }
    return { slug, status: "error", error: err?.message || String(err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Traitement de ${brands.length} marques...\n`);

  const results: Array<{ slug: string; status: string; logoUrl?: string; error?: string }> = [];

  // Traitement séquentiel pour éviter de surcharger les serveurs
  for (let i = 0; i < brands.length; i++) {
    const { slug, url } = brands[i];
    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/${brands.length}] ${slug.padEnd(30)} → `);

    const result = await processBrand(slug, url);
    results.push(result);

    if (result.status === "ok") {
      console.log(`✅ ${result.logoUrl}`);
    } else if (result.status === "skip") {
      console.log(`⏭  SKIP — ${result.error}`);
    } else {
      console.log(`❌ ERREUR — ${result.error}`);
    }

    // Pause courte entre chaque requête pour être poli avec les serveurs
    await new Promise((r) => setTimeout(r, 500));
  }

  // ─── Résumé ───────────────────────────────────────────────
  const ok    = results.filter((r) => r.status === "ok");
  const skip  = results.filter((r) => r.status === "skip");
  const error = results.filter((r) => r.status === "error");

  console.log("\n─────────────────────────────────────────────────");
  console.log(`✅ Succès  : ${ok.length}/${brands.length}`);
  console.log(`⏭  Ignorés : ${skip.length}/${brands.length}`);
  console.log(`❌ Erreurs : ${error.length}/${brands.length}`);

  if (skip.length > 0) {
    console.log("\n⏭  Marques ignorées (logo non trouvé) :");
    skip.forEach((r) => console.log(`   - ${r.slug} : ${r.error}`));
  }
  if (error.length > 0) {
    console.log("\n❌ Marques en erreur :");
    error.forEach((r) => console.log(`   - ${r.slug} : ${r.error}`));
  }
  console.log("─────────────────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error("❌ Erreur fatale :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

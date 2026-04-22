/**
 * update-brand-logo.ts
 * ─────────────────────────────────────────────────────────────
 * Met à jour le logo de la marque King Brown :
 *  1. Télécharge le logo officiel depuis kingbrownpomade.com
 *  2. L'uploade sur Cloudinary (dossier barberparadise/brands)
 *  3. Met à jour Brand.logo via Prisma direct
 *
 * Usage (depuis le Shell Render) :
 *   npx ts-node scripts/update-brand-logo.ts
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

// ─── Config Cloudinary ──────────────────────────────────────
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const API_KEY    = process.env.CLOUDINARY_API_KEY    || "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

// Diagnostic : afficher les variables lues (masquées)
console.log("\n🔧 Variables Cloudinary lues depuis process.env :");
console.log(`   CLOUDINARY_CLOUD_NAME  : ${CLOUD_NAME  ? CLOUD_NAME              : "❌ NON DÉFINIE"}`);
console.log(`   CLOUDINARY_API_KEY     : ${API_KEY     ? API_KEY.slice(0, 6) + "..." : "❌ NON DÉFINIE"}`);
console.log(`   CLOUDINARY_API_SECRET  : ${API_SECRET  ? API_SECRET.slice(0, 4) + "..." : "❌ NON DÉFINIE"}`);

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error("\n❌ Erreur : une ou plusieurs variables Cloudinary sont manquantes.");
  console.error("   Vérifie que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET");
  console.error("   sont bien définies dans les variables d'environnement Render.");
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key:    API_KEY,
  api_secret: API_SECRET,
  secure:     true,
});

// ─── Télécharger une image vers un fichier temporaire ─────────
function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Suivre la redirection
          file.close();
          downloadImage(res.headers.location!, destPath)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

// ─── Trouver l'URL du logo sur kingbrownpomade.com ───────────
async function findLogoUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "kingbrownpomade.com",
      path: "/",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    };

    https.get(options, (res) => {
      let html = "";
      res.on("data", (chunk) => (html += chunk));
      res.on("end", () => {
        // Chercher le logo dans les src= du HTML
        const match = html.match(
          /\/\/kingbrownpomade\.com\/cdn\/shop\/files\/ui-king-brown-logo[^"'\s]*/
        );
        if (match) {
          resolve("https:" + match[0]);
        } else {
          // Fallback : URL connue avec version stable
          console.warn(
            "⚠ Logo non trouvé dynamiquement, utilisation de l'URL connue."
          );
          resolve(
            "https://kingbrownpomade.com/cdn/shop/files/ui-king-brown-logo.png?v=1754395291"
          );
        }
      });
      res.on("error", reject);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Recherche du logo King Brown sur kingbrownpomade.com...");

  // 1. Trouver l'URL du logo
  const logoUrl = await findLogoUrl();
  console.log(`✅ URL du logo trouvée : ${logoUrl}`);

  // 2. Télécharger le logo dans un fichier temporaire
  const tmpPath = path.join(os.tmpdir(), "king-brown-logo.png");
  console.log(`⬇  Téléchargement vers ${tmpPath}...`);
  await downloadImage(logoUrl, tmpPath);
  const size = fs.statSync(tmpPath).size;
  console.log(`✅ Logo téléchargé (${size} octets)`);

  // 3. Uploader sur Cloudinary
  console.log("☁  Upload sur Cloudinary...");
  const uploadResult = await cloudinary.uploader.upload(tmpPath, {
    folder: "barberparadise/brands",
    public_id: "king-brown-logo",
    overwrite: true,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fit" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });
  const cloudinaryUrl = uploadResult.secure_url;
  console.log(`✅ Cloudinary URL : ${cloudinaryUrl}`);

  // 4. Nettoyer le fichier temporaire
  fs.unlinkSync(tmpPath);

  // 5. Mettre à jour en base via Prisma
  console.log("💾 Mise à jour de Brand.logo en base...");
  const updated = await prisma.brand.update({
    where: { slug: "king-brown" },
    data: {
      logo: cloudinaryUrl,
      website: "https://kingbrownpomade.com",
    },
  });

  console.log(`\n✅ Brand mise à jour avec succès !`);
  console.log(`   ID      : ${updated.id}`);
  console.log(`   Nom     : ${updated.name}`);
  console.log(`   Slug    : ${updated.slug}`);
  console.log(`   Logo    : ${updated.logo}`);
  console.log(`   Website : ${updated.website}`);
}

main()
  .catch((err) => {
    console.error("❌ Erreur :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

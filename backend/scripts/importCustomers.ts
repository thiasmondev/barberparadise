/**
 * scripts/importCustomers.ts
 *
 * Importe les clients depuis un export CSV Shopify dans la base Barber Paradise.
 *
 * Usage :
 *   npx ts-node scripts/importCustomers.ts customers_export.csv
 *   npx ts-node scripts/importCustomers.ts /tmp/customers_export.csv
 *   npx ts-node scripts/importCustomers.ts https://url-du-fichier.csv
 *
 * Le script est idempotent : les emails déjà présents sont ignorés.
 * Aucun email n'est envoyé pendant l'import et aucun mot de passe n'est logué.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface ShopifyCustomerRow {
  "First Name"?: string;
  "Last Name"?: string;
  Email?: string;
  "Default Address Company"?: string;
  "Default Address Address1"?: string;
  "Default Address Address2"?: string;
  "Default Address City"?: string;
  "Default Address Province Code"?: string;
  "Default Address Country Code"?: string;
  "Default Address Zip"?: string;
  "Default Address Phone"?: string;
  "Total Spent"?: string;
  "Total Orders"?: string;
  "Accepts Email Marketing"?: string;
}

interface ImportCounters {
  imported: number;
  skipped: number;
  proAccountsCreated: number;
  errors: number;
}

function clean(value: string | undefined): string {
  return (value || "").trim();
}

function normalizeEmail(email: string | undefined): string {
  return clean(email).toLowerCase();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function loadCsvSource(source: string): Promise<string> {
  if (isHttpUrl(source)) {
    console.log(`Téléchargement du CSV depuis l'URL : ${source}`);
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Téléchargement impossible (${response.status} ${response.statusText})`);
    }
    return response.text();
  }

  if (!fs.existsSync(source)) {
    throw new Error(`Fichier CSV introuvable : ${source}`);
  }

  console.log(`Lecture du CSV local : ${source}`);
  return fs.readFileSync(source, "utf-8");
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = clean(value).toLowerCase();
  return ["yes", "true", "1", "oui", "y"].includes(normalized);
}

function parseNumber(value: string | undefined): number {
  const normalized = clean(value).replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasAddress(row: ShopifyCustomerRow): boolean {
  return Boolean(
    clean(row["Default Address Address1"]) ||
      clean(row["Default Address Address2"]) ||
      clean(row["Default Address City"]) ||
      clean(row["Default Address Zip"])
  );
}

function buildCountry(row: ShopifyCustomerRow): string {
  const countryCode = clean(row["Default Address Country Code"]).toUpperCase();
  if (!countryCode || countryCode === "FR") return "France";
  return countryCode;
}

function buildActivity(row: ShopifyCustomerRow): string {
  const totalOrders = parseNumber(row["Total Orders"]);
  const totalSpent = parseNumber(row["Total Spent"]);
  return `Professionnel importé Shopify (${totalOrders} commandes, ${totalSpent.toFixed(2)} € dépensés)`;
}

async function main() {
  const csvSource = process.argv[2] || path.join(__dirname, "customers_export.csv");

  let raw: string;
  try {
    raw = await loadCsvSource(csvSource);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error("Usage : npx ts-node scripts/importCustomers.ts <chemin-local-ou-url-csv>");
    process.exit(1);
  }

  const rows: ShopifyCustomerRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    bom: true,
  });

  console.log(`${rows.length} lignes clients trouvées dans le CSV`);

  const counters: ImportCounters = {
    imported: 0,
    skipped: 0,
    proAccountsCreated: 0,
    errors: 0,
  };

  for (const [index, row] of rows.entries()) {
    const email = normalizeEmail(row.Email);

    if (!email) {
      counters.errors += 1;
      console.error(`Erreur ligne ${index + 2} : email manquant`);
      continue;
    }

    try {
      const existing = await prisma.customer.findUnique({ where: { email } });
      if (existing) {
        counters.skipped += 1;
        console.log(`SKIP ${email} : client déjà existant`);
        continue;
      }

      const firstName = clean(row["First Name"]) || "Client";
      const lastName = clean(row["Last Name"]) || "Shopify";
      const phone = clean(row["Default Address Phone"]) || null;
      const acceptsEmailMarketing = parseBoolean(row["Accepts Email Marketing"]);
      const companyName = clean(row["Default Address Company"]);
      const temporaryPassword = crypto.randomBytes(24).toString("base64url");
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

      const created = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            mustResetPassword: true,
            acceptsEmailMarketing,
          },
        });

        if (hasAddress(row)) {
          const addressLines = [clean(row["Default Address Address1"]), clean(row["Default Address Address2"])].filter(Boolean);
          await tx.address.create({
            data: {
              customerId: customer.id,
              firstName,
              lastName,
              address: addressLines[0] || "Adresse importée Shopify",
              extension: addressLines.slice(1).join(" ") || clean(row["Default Address Province Code"]),
              city: clean(row["Default Address City"]) || "Ville non renseignée",
              postalCode: clean(row["Default Address Zip"]) || "00000",
              country: buildCountry(row),
              isDefault: true,
            },
          });
        }

        let proAccountCreated = false;
        if (companyName) {
          await tx.proAccount.create({
            data: {
              customerId: customer.id,
              companyName,
              activity: buildActivity(row),
              phone: phone || "Non renseigné",
              status: "approved",
              approvedAt: new Date(),
              approvedBy: "shopify-import",
            },
          });
          proAccountCreated = true;
        }

        if (acceptsEmailMarketing) {
          await tx.newsletterSubscriber.upsert({
            where: { email },
            create: { email },
            update: { unsubscribedAt: null },
          });
        }

        return { customer, proAccountCreated };
      });

      counters.imported += 1;
      if (created.proAccountCreated) counters.proAccountsCreated += 1;
      console.log(`SUCCESS ${email} : client importé${created.proAccountCreated ? " + compte pro" : ""}`);
    } catch (error) {
      counters.errors += 1;
      console.error(`ERREUR ${email} : import impossible`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log("RÉSULTAT DE L'IMPORT CLIENTS SHOPIFY");
  console.log(`${"─".repeat(60)}`);
  console.log(`Nombre de clients importés : ${counters.imported}`);
  console.log(`Nombre de clients skippés (déjà existants) : ${counters.skipped}`);
  console.log(`Nombre de comptes pro créés : ${counters.proAccountsCreated}`);
  console.log(`Nombre d'erreurs : ${counters.errors}`);
  console.log(`${"─".repeat(60)}\n`);
}

main()
  .catch((err) => {
    console.error("Erreur fatale :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

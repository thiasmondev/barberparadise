/**
 * Script de rattrapage des factures manquantes — Barber Paradise
 *
 * Cible les commandes en ligne payées sans facture complète.
 * Par défaut : dry-run (aucune écriture). Passer --execute pour générer réellement.
 *
 * Usage :
 *   npx tsx scripts/backfillMissingInvoices.ts           # dry-run
 *   npx tsx scripts/backfillMissingInvoices.ts --execute  # exécution réelle
 */

import { prisma } from "../src/utils/prisma";
import { ensureB2CInvoiceForOrder } from "../src/services/b2cInvoiceService";
import { ensureProInvoiceForOrder } from "../src/services/proInvoiceService";

const isDryRun = !process.argv.includes("--execute");

async function main() {
  console.log(`\n=== Rattrapage factures manquantes (${isDryRun ? "DRY-RUN" : "EXÉCUTION RÉELLE"}) ===\n`);

  const orders = await prisma.order.findMany({
    where: {
      channel: "online",
      status: { in: ["paid", "processing", "shipped", "delivered"] },
      OR: [
        { invoiceNumber: null },
        { invoiceUrl: null },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      isB2B: true,
      invoiceNumber: true,
      invoiceUrl: true,
      proInvoiceNumber: true,
      proInvoiceUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Commandes éligibles trouvées : ${orders.length}\n`);

  if (orders.length === 0) {
    console.log("Aucune commande à traiter. Tout est à jour.");
    await prisma.$disconnect();
    return;
  }

  for (const order of orders) {
    const missingB2C = !order.invoiceNumber || !order.invoiceUrl;
    const missingB2B = order.isB2B && (!order.proInvoiceNumber || !order.proInvoiceUrl);

    console.log(`[${order.orderNumber}] créée le ${order.createdAt.toISOString().slice(0, 10)} | B2B: ${order.isB2B} | Facture B2C manquante: ${missingB2C} | Facture B2B manquante: ${missingB2B}`);

    if (isDryRun) continue;

    try {
      if (missingB2C) {
        const result = await ensureB2CInvoiceForOrder(order.id);
        console.log(`  → Facture B2C générée : ${result?.invoiceNumber || "erreur"}`);
      }
      if (missingB2B) {
        // Ne pas envoyer d'email séparé pour éviter les doublons non maîtrisés
        const result = await ensureProInvoiceForOrder(order.id, { sendInvoiceEmail: false });
        console.log(`  → Facture B2B générée : ${result?.invoiceNumber || "erreur"}`);
      }
    } catch (err) {
      console.error(`  → ERREUR pour ${order.orderNumber} :`, err instanceof Error ? err.message : err);
    }
  }

  if (isDryRun) {
    console.log(`\n[DRY-RUN] Aucune modification effectuée. Relancer avec --execute pour générer les factures.`);
  } else {
    console.log(`\nRattrapage terminé.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});

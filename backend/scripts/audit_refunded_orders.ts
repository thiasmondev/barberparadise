import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ─────────────────────────────────────────────────────────────────────────
  // PARTIE 1 — Correction manuelle de BP-2026-80817
  // ─────────────────────────────────────────────────────────────────────────
  console.log("=== CORRECTION MANUELLE BP-2026-80817 ===\n");
  const order80817 = await prisma.order.findFirst({
    where: { orderNumber: "BP-2026-80817" },
    select: { id: true, orderNumber: true, status: true },
  });
  if (order80817) {
    if (order80817.status === "refunded" || order80817.status === "cancelled") {
      await prisma.order.update({ where: { id: order80817.id }, data: { status: "paid" } });
      console.log(`✅ BP-2026-80817 repassée en "paid" (était "${order80817.status}").\n`);
    } else {
      console.log(`ℹ️  BP-2026-80817 est déjà au statut "${order80817.status}" — aucune modification.\n`);
    }
  } else {
    console.log("❌ Commande BP-2026-80817 introuvable.\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARTIE 2 — Commandes "refunded" sans remboursement réel (refundMode null)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== AUDIT — Commandes "REMBOURSÉE" sans remboursement réel ===\n');
  const fakeRefunded = await prisma.order.findMany({
    where: { status: "refunded", refundMode: null },
    select: { orderNumber: true, email: true, totalTTC: true, providerPaymentId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (fakeRefunded.length === 0) {
    console.log("✅ Aucune commande suspecte dans ce cas.\n");
  } else {
    console.log(`⚠️  ${fakeRefunded.length} commande(s) marquées "refunded" sans refundMode :`);
    console.table(fakeRefunded.map((o) => ({
      Commande: o.orderNumber, Email: o.email, Montant: `${o.totalTTC} €`,
      PaymentId: o.providerPaymentId || "(aucun)", Date: o.createdAt.toISOString().split("T")[0],
    })));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARTIE 3 — Commandes "cancelled" avec un paymentId (potentiellement payées)
  //
  // ⚠️  LISTE SUSPECTE à vérifier manuellement côté Mollie avant toute correction.
  //     Vérifiez le statut Mollie de chaque paymentId — si "paid", repasser en "paid".
  // ─────────────────────────────────────────────────────────────────────────
  console.log('=== AUDIT — Commandes "ANNULÉE" avec un paymentId (à vérifier côté Mollie) ===\n');
  const suspiciousCancelled = await prisma.order.findMany({
    where: { status: "cancelled", NOT: { providerPaymentId: null } },
    select: { orderNumber: true, email: true, totalTTC: true, providerPaymentId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (suspiciousCancelled.length === 0) {
    console.log("✅ Aucune commande suspecte dans ce cas.\n");
  } else {
    console.log(`⚠️  ${suspiciousCancelled.length} commande(s) annulées avec un paymentId (à vérifier manuellement côté Mollie) :`);
    console.log("    → Pour chaque ligne, vérifiez dans Mollie si le paymentId = paiement PAYÉ.");
    console.log("    → Si oui, repasser la commande en 'paid' depuis l'admin.\n");
    console.table(suspiciousCancelled.map((o) => ({
      Commande: o.orderNumber, Email: o.email, Montant: `${o.totalTTC} €`,
      PaymentId: o.providerPaymentId || "(aucun)", Date: o.createdAt.toISOString().split("T")[0],
    })));
  }

  console.log("=== FIN DE L'AUDIT ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());

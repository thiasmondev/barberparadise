import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== CORRECTION MANUELLE BP-2026-80817 ===");
  const order = await prisma.order.findFirst({ where: { orderNumber: "BP-2026-80817" } });
  if (order) {
    if (order.status === "refunded" || order.status === "cancelled") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "paid" }
      });
      console.log(`✅ Commande BP-2026-80817 repassée en statut "paid".`);
    } else {
      console.log(`ℹ️ Commande BP-2026-80817 est déjà au statut "${order.status}".`);
    }
  } else {
    console.log("❌ Commande BP-2026-80817 introuvable.");
  }

  console.log("\n=== AUDIT DES COMMANDES MAL MARQUÉES 'REMBOURSÉE' ===");
  // On cherche les commandes "refunded" mais qui n'ont pas de refundMode défini (donc pas passées par le nouveau flux de remboursement)
  const suspiciousOrders = await prisma.order.findMany({
    where: {
      status: "refunded",
      refundMode: null
    },
    select: {
      orderNumber: true,
      email: true,
      totalTTC: true,
      providerPaymentId: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  if (suspiciousOrders.length === 0) {
    console.log("✅ Aucune commande suspecte trouvée.");
  } else {
    console.log(`⚠️ ${suspiciousOrders.length} commandes potentiellement mal marquées trouvées :`);
    console.table(suspiciousOrders.map(o => ({
      Commande: o.orderNumber,
      Email: o.email,
      Montant: `${o.totalTTC} €`,
      PaymentId: o.providerPaymentId,
      Date: o.createdAt.toISOString().split('T')[0]
    })));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

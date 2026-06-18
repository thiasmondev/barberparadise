/**
 * Script de diagnostic : liste les commandes payées avec transporteur null/vide
 * Usage : npx ts-node scripts/diagCarrierNull.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["paid", "processing", "shipped"] },
      channel: { not: "pos" },
      shipment: {
        OR: [
          { carrier: null },
          { carrier: "" },
        ],
      },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      shipping: true,
      shipment: { select: { carrier: true, totalWeightG: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (orders.length === 0) {
    console.log("✅ Aucune commande payée avec transporteur null/vide.");
    return;
  }

  console.log(`⚠️  ${orders.length} commande(s) payées avec transporteur non défini :\n`);
  console.log("Numéro        | Statut      | Date                | Frais envoi | Carrier actuel");
  console.log("------------- | ----------- | ------------------- | ----------- | --------------");
  for (const order of orders) {
    const date = order.createdAt.toISOString().slice(0, 19).replace("T", " ");
    const carrier = order.shipment?.carrier ?? "NULL";
    const shipping = `${order.shipping?.toFixed(2) ?? "0.00"} €`;
    console.log(`${order.orderNumber.padEnd(13)} | ${order.status.padEnd(11)} | ${date} | ${shipping.padEnd(11)} | ${carrier}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

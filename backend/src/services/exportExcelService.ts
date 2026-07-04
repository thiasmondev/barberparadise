import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { parseIndyMonth } from "./indyReportService";

const prisma = new PrismaClient();

// Liste de tous les statuts considérés comme "payés" pour cet export
const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];

export async function generateFinanceExcel(monthParam?: unknown): Promise<Buffer> {
  const { month, start, end } = parseIndyMonth(monthParam);

  // Récupérer toutes les commandes payées du mois (online + pos)
  const orders = await prisma.order.findMany({
    where: {
      status: { in: PAID_STATUSES },
      createdAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalTTC: true,
      total: true,
      paymentMethod: true,
      paymentProvider: true,
      channel: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      shippingAddress: {
        select: {
          country: true,
        },
      },
      billingAddress: true, // billingAddress est de type Json dans le schéma
    },
    orderBy: { createdAt: "asc" },
  });

  // Fonction utilitaire pour extraire la passerelle
  const getPasserelle = (order: any): string => {
    const provider = (order.paymentProvider || "").toLowerCase();
    const method = (order.paymentMethod || "").toLowerCase();
    
    if (order.channel === "pos") {
      if (method.includes("cash") || method.includes("espèce") || method.includes("espece")) return "Espèces";
      if (method.includes("card") || method.includes("carte") || method.includes("tap")) return "Carte (POS)";
      return "Manuel";
    }

    if (provider.includes("mollie")) return "Carte/Mollie";
    if (provider.includes("paypal")) {
      if (method.includes("paylater") || method.includes("4x")) return "PayPal 4x";
      return "PayPal";
    }
    if (method.includes("virement") || method.includes("transfer")) return "Virement";
    if (method.includes("instant") || method.includes("bank")) return "Paiement bancaire instantané";
    
    return order.paymentMethod || order.paymentProvider || "Manuel";
  };

  // Préparer les données
  const data = orders.map(order => {
    const net = Number(order.totalTTC || order.total || 0);
    
    // Extraire le pays du JSON billingAddress si présent
    let billingCountry = "";
    if (order.billingAddress && typeof order.billingAddress === "object" && !Array.isArray(order.billingAddress)) {
      const ba = order.billingAddress as any;
      billingCountry = ba.country || "";
    }
    
    const pays = billingCountry.trim() || order.shippingAddress?.country?.trim() || "France";
    const dateStr = order.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
    const client = order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : "Client inconnu";
    const passerelle = getPasserelle(order);

    return {
      orderNumber: order.orderNumber,
      date: dateStr,
      client,
      passerelle,
      net,
      pays,
    };
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Barber Paradise";
  workbook.created = new Date();

  // ---------------------------------------------------------
  // Onglet 1 : Pivot par passerelle
  // ---------------------------------------------------------
  const sheet1 = workbook.addWorksheet("Pivot par passerelle");
  sheet1.columns = [
    { header: "Passerelle", key: "passerelle", width: 30 },
    { header: "Net TTC", key: "net", width: 15 },
  ];

  const pivotPasserelle = new Map<string, number>();
  let totalNet1 = 0;
  for (const row of data) {
    pivotPasserelle.set(row.passerelle, (pivotPasserelle.get(row.passerelle) || 0) + row.net);
    totalNet1 += row.net;
  }

  const pivotPasserelleSorted = Array.from(pivotPasserelle.entries()).sort((a, b) => b[1] - a[1]);
  for (const [passerelle, net] of pivotPasserelleSorted) {
    sheet1.addRow({ passerelle, net });
  }
  
  const totalRow1 = sheet1.addRow({ passerelle: "TOTAL", net: totalNet1 });
  totalRow1.font = { bold: true };
  sheet1.getRow(1).font = { bold: true };
  sheet1.getColumn("net").numFmt = "#,##0.00 €";

  // ---------------------------------------------------------
  // Onglet 2 : Par date & passerelle
  // ---------------------------------------------------------
  const sheet2 = workbook.addWorksheet("Par date & passerelle");
  sheet2.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Passerelle", key: "passerelle", width: 30 },
    { header: "Net TTC", key: "net", width: 15 },
  ];

  const pivotDatePasserelle = new Map<string, number>();
  let totalNet2 = 0;
  for (const row of data) {
    const key = `${row.date}|${row.passerelle}`;
    pivotDatePasserelle.set(key, (pivotDatePasserelle.get(key) || 0) + row.net);
    totalNet2 += row.net;
  }

  const pivotDatePasserelleSorted = Array.from(pivotDatePasserelle.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, net] of pivotDatePasserelleSorted) {
    const [date, passerelle] = key.split("|");
    sheet2.addRow({ date, passerelle, net });
  }

  const totalRow2 = sheet2.addRow({ date: "TOTAL", passerelle: "", net: totalNet2 });
  totalRow2.font = { bold: true };
  sheet2.getRow(1).font = { bold: true };
  sheet2.getColumn("net").numFmt = "#,##0.00 €";

  // ---------------------------------------------------------
  // Onglet 3 : Détail (avec pays)
  // ---------------------------------------------------------
  const sheet3 = workbook.addWorksheet("Détail (avec pays)");
  sheet3.columns = [
    { header: "Numéro commande", key: "orderNumber", width: 20 },
    { header: "Date", key: "date", width: 15 },
    { header: "Client", key: "client", width: 30 },
    { header: "Passerelle", key: "passerelle", width: 30 },
    { header: "Net TTC", key: "net", width: 15 },
    { header: "Pays", key: "pays", width: 20 },
  ];

  for (const row of data) {
    sheet3.addRow(row);
  }

  sheet3.getRow(1).font = { bold: true };
  sheet3.getColumn("net").numFmt = "#,##0.00 €";

  // ---------------------------------------------------------
  // Onglet 4 : Total par pays
  // ---------------------------------------------------------
  const sheet4 = workbook.addWorksheet("Total par pays");
  sheet4.columns = [
    { header: "Pays", key: "pays", width: 30 },
    { header: "Net TTC", key: "net", width: 15 },
  ];

  const pivotPays = new Map<string, number>();
  let totalNet4 = 0;
  for (const row of data) {
    pivotPays.set(row.pays, (pivotPays.get(row.pays) || 0) + row.net);
    totalNet4 += row.net;
  }

  const pivotPaysSorted = Array.from(pivotPays.entries()).sort((a, b) => b[1] - a[1]);
  for (const [pays, net] of pivotPaysSorted) {
    sheet4.addRow({ pays, net });
  }

  const totalRow4 = sheet4.addRow({ pays: "TOTAL", net: totalNet4 });
  totalRow4.font = { bold: true };
  sheet4.getRow(1).font = { bold: true };
  sheet4.getColumn("net").numFmt = "#,##0.00 €";

  // Renvoyer le buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

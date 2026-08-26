import assert from "node:assert/strict";
import { aggregateFinanceOverview, parseFinanceMonth } from "./financeOverviewService";

const { month, start, end } = parseFinanceMonth("2026-08");
const report = aggregateFinanceOverview(month, start, end, [
  {
    id: "card-processing",
    paymentMethod: "card",
    paymentProvider: "mollie",
    channel: "online",
    posPaymentBreakdown: null,
    total: 120,
    totalTTC: 120,
    totalHT: 100,
    vatAmount: 20,
    vatRate: 20,
    shippingAddress: { country: "France" },
  },
  {
    id: "split-pos",
    paymentMethod: "split",
    paymentProvider: null,
    channel: "pos",
    posPaymentBreakdown: [{ method: "indy", amount: 6 }, { method: "cash", amount: 4 }],
    total: 10,
    totalTTC: 10,
    totalHT: 8.33,
    vatAmount: 1.67,
    vatRate: 20,
    shippingAddress: { country: "France" },
  },
  {
    id: "paypal",
    paymentMethod: "paypal",
    paymentProvider: "paypal",
    channel: "online",
    posPaymentBreakdown: null,
    total: 50,
    totalTTC: 50,
    totalHT: 41.67,
    vatAmount: 8.33,
    vatRate: 20,
    shippingAddress: { country: "France" },
  },
  {
    id: "legacy-shipping",
    paymentMethod: "paybybank",
    paymentProvider: "mollie",
    channel: "online",
    posPaymentBreakdown: null,
    total: 132.9,
    totalTTC: 132.9,
    // Ancien enregistrement : les 12,90 € de livraison manquent dans HT/TVA.
    totalHT: 100,
    vatAmount: 20,
    vatRate: 20,
    shippingAddress: { country: "France" },
  },
]);

assert.equal(report.summary.nbCommandesTotal, 4);
assert.equal(report.summary.caTTCTotal, 312.9);
assert.equal(report.summary.caHTTotal, 260.75);
assert.equal(report.summary.tvaCollecteeTotal, 52.15);
assert.equal(report.summary.caHTTotal + report.summary.tvaCollecteeTotal, report.summary.caTTCTotal);
assert.deepEqual(report.ventesParMoyenPaiement, [
  { moyenPaiement: "Carte bancaire", ventesRealisees: 120 },
  { moyenPaiement: "PayPal", ventesRealisees: 50 },
  { moyenPaiement: "Pay by Bank", ventesRealisees: 132.9 },
  { moyenPaiement: "Indy", ventesRealisees: 6 },
  { moyenPaiement: "Espèces", ventesRealisees: 4 },
]);
assert.equal(report.ventesParMoyenPaiement.reduce((sum, line) => sum + line.ventesRealisees, 0), report.summary.caTTCTotal);

console.log("✓ Bilan Finance consolidé : tous canaux et ventilation DIVISER validés");

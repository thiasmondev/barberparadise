import assert from "node:assert/strict";
import {
  buildIndyCsv,
  buildIndyEmailHtml,
  IndyReport,
  parseIndyMonth,
  previousMonthKey,
} from "./indyReportService";

function makeReport(): IndyReport {
  return {
    month: "2026-04",
    period: {
      start: "2026-04-01T00:00:00.000Z",
      end: "2026-05-01T00:00:00.000Z",
    },
    ventesParPSP: [
      {
        psp: "Mollie",
        ventesRealisees: 120,
        commissionsPrelevees: 0,
        variationTotale: 120,
      },
    ],
    ventesParPaysEtTVA: [
      {
        paysLivraison: "France",
        tauxTVA: 20,
        totalHT: 100,
        montantTVA: 20,
        totalTTC: 120,
        nbCommandes: 1,
      },
    ],
    remboursements: [],
    csvRows: [
      {
        type: "Marchandise",
        pays_expedition: "France",
        pays_livraison: "France",
        tva_pct: 20,
        total_ttc: 120,
        moyen_paiement: "Mollie",
      },
      {
        type: "Marchandise",
        pays_expedition: "France",
        pays_livraison: "Belgique, Zone UE",
        tva_pct: 20,
        total_ttc: 49.9,
        moyen_paiement: "PayPal",
      },
    ],
    summary: {
      caHTTotal: 100,
      tvaCollecteeTotal: 20,
      caTTCTotal: 120,
      nbCommandesTotal: 1,
    },
  };
}

function testMonthParsing() {
  const parsed = parseIndyMonth("2026-04");
  assert.equal(parsed.month, "2026-04");
  assert.equal(parsed.start.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(parsed.end.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(previousMonthKey(new Date("2026-05-04T12:00:00.000Z")), "2026-04");
  assert.throws(() => parseIndyMonth("2026-13"), /Mois Indy invalide/);
  assert.throws(() => parseIndyMonth("04-2026"), /YYYY-MM/);
}

function testCsvFormat() {
  const csv = buildIndyCsv(makeReport());
  assert.equal(
    csv,
    [
      "type,pays_expedition,pays_livraison,tva_pct,total_ttc,moyen_paiement",
      "Marchandise,France,France,20,120.00,Mollie",
      "Marchandise,France,\"Belgique, Zone UE\",20,49.90,PayPal",
      "",
    ].join("\n")
  );
}

function testEmailReminderAndCfoEscaping() {
  const html = buildIndyEmailHtml(makeReport(), "Vérifier <TVA> & PSP");
  assert.match(html, /À clôturer avant le 14 mai 2026/);
  assert.match(html, /Vérifier &lt;TVA&gt; &amp; PSP/);
  assert.match(html, /Le CSV Indy du mois est joint à cet email/);
}

function run() {
  testMonthParsing();
  testCsvFormat();
  testEmailReminderAndCfoEscaping();
  console.log("indyReportService.test.ts: OK");
}

run();

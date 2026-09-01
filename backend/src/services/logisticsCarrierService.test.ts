import assert from "node:assert/strict";
import { buildShipmentQuotes } from "./logisticsCarrierService";

function run() {
  const quotes = buildShipmentQuotes({
    orderNumber: "BP-TEST-ASSURANCE",
    customerEmail: "client@example.test",
    recipient: {
      firstName: "Client",
      lastName: "Test",
      address: "1 rue de la Paix",
      postalCode: "01250",
      city: "Ceyzériat",
      country: "FR",
    },
    totalWeightG: 700,
    orderValueCents: 66_511,
    carrierOptions: {
      colissimo: { insuranceValueCents: 66_511, signatureRequired: false },
    },
  });

  const colissimo = quotes.find((quote) => quote.carrier === "colissimo");
  assert.ok(colissimo, "Le devis Colissimo doit être présent.");
  assert.equal(colissimo.insuranceValueCents, 100_000, "665,11 € doit être arrondi au palier assuré de 1 000 €.");
  assert.equal(colissimo.signatureRequired, true, "Une valeur assurée nationale doit activer la signature.");
  assert.equal(colissimo.serviceCode, "DOS", "Une valeur assurée nationale doit employer le produit DOS compatible.");

  const standardQuotes = buildShipmentQuotes({
    orderNumber: "BP-TEST-SANS-ASSURANCE",
    customerEmail: "client@example.test",
    recipient: {
      firstName: "Client",
      lastName: "Test",
      address: "1 rue de la Paix",
      postalCode: "01250",
      city: "Ceyzériat",
      country: "FR",
    },
    totalWeightG: 700,
    orderValueCents: 10_000,
  });
  const standardColissimo = standardQuotes.find((quote) => quote.carrier === "colissimo");
  assert.ok(standardColissimo, "Le devis Colissimo standard doit être présent.");
  assert.equal(standardColissimo.serviceCode, "DOM", "Un envoi sans assurance conserve le service DOM sans signature.");

  console.log("✓ Logistics carrier assurance tests passed");
}

run();

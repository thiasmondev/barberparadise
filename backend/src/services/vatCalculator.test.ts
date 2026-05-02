import assert from "node:assert/strict";
import { EU_COUNTRIES, getVatEmailLabel, getVatRate } from "./vatCalculator";

assert.equal(EU_COUNTRIES.includes("FR"), true);
assert.equal(EU_COUNTRIES.includes("BE"), true);
assert.equal(EU_COUNTRIES.includes("US"), false);

assert.equal(getVatRate("FR", false), 20);
assert.equal(getVatRate("BE", false), 20);
assert.equal(getVatRate("DE", true, "DE123456789"), 0);
assert.equal(getVatRate("FR", true, "FR12345678901"), 20);
assert.equal(getVatRate("CH", false), 0);
assert.equal(getVatRate("US", true, "US123"), 0);
assert.equal(getVatRate("BE", true), 20);

assert.equal(
  getVatEmailLabel({ country: "FR", isB2B: false, vatRate: 20 }),
  "TVA (20%)",
);
assert.equal(
  getVatEmailLabel({ country: "BE", isB2B: true, vatNumber: "BE0123456789", vatRate: 0 }),
  "TVA : 0% — Autoliquidation (art. 283-2 du CGI)",
);
assert.equal(
  getVatEmailLabel({ country: "US", isB2B: false, vatRate: 0 }),
  "TVA : 0% — Exportation exonérée",
);

console.log("vatCalculator regression tests passed");

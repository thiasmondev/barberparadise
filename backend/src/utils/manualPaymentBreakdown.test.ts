import assert from "node:assert/strict";
import {
  getManualPaymentMethodLabel,
  validateManualPaymentSplitLines,
} from "./manualPaymentBreakdown";

const allocations = validateManualPaymentSplitLines([
  { method: "external_card", amount: 6.5 },
  { method: "cash", amount: 3.5 },
], 10);

assert.deepEqual(allocations, [
  { method: "external_card", amount: 6.5 },
  { method: "cash", amount: 3.5 },
]);
assert.equal(getManualPaymentMethodLabel("external_card"), "Carte via lien externe");
assert.throws(
  () => validateManualPaymentSplitLines([{ method: "cash", amount: 10 }], 10),
  /au moins 2 lignes/i,
);
assert.throws(
  () => validateManualPaymentSplitLines([{ method: "cash", amount: 6 }, { method: "virement", amount: 3 }], 10),
  /ne correspond pas/i,
);

console.log("✓ Ventilation manuelle validée : 6,50 € carte externe + 3,50 € espèces = 10,00 €");

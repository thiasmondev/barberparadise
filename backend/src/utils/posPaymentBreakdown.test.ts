import assert from "node:assert/strict";
import { getPosSplitAllocations } from "./posPaymentBreakdown";

const allocations = getPosSplitAllocations({
  paymentMethod: "split",
  totalTTC: 10,
  total: 10,
  posPaymentBreakdown: [
    { method: "indy", amount: 6 },
    { method: "cash", amount: 4 },
  ],
});

assert.deepEqual(allocations, [
  { method: "indy", amount: 6 },
  { method: "cash", amount: 4 },
]);
assert.equal(allocations?.reduce((sum, allocation) => sum + allocation.amount, 0), 10);

const malformed = getPosSplitAllocations({
  paymentMethod: "split",
  totalTTC: 10,
  posPaymentBreakdown: [{ method: "indy", amount: 10 }],
});
assert.equal(malformed, null);

console.log("✓ Ventilation POS DIVISER validée : 6,00 € Indy + 4,00 € Espèces = 10,00 €");

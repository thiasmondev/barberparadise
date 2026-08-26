import assert from "node:assert/strict";
import {
  getSalesPaymentAllocations,
  resolveSalesDashboardPeriod,
} from "./salesDashboardService";

const splitOrder = {
  id: "split-test",
  paymentMethod: "split",
  paymentProvider: null,
  channel: "pos",
  posPaymentBreakdown: [
    { method: "indy", amount: 6 },
    { method: "cash", amount: 4 },
  ],
  totalTTC: 10,
  total: 10,
};

assert.deepEqual(getSalesPaymentAllocations(splitOrder), [
  { category: "Indy", amount: 6 },
  { category: "Espèces", amount: 4 },
]);

assert.deepEqual(getSalesPaymentAllocations({
  id: "paypal-test",
  paymentMethod: "paypal",
  paymentProvider: "paypal",
  channel: "online",
  posPaymentBreakdown: null,
  totalTTC: 24.5,
  total: 24.5,
}), [{ category: "PayPal", amount: 24.5 }]);

assert.deepEqual(getSalesPaymentAllocations({
  id: "paybybank-test",
  paymentMethod: "paybybank",
  paymentProvider: "mollie",
  channel: "online",
  posPaymentBreakdown: null,
  totalTTC: 19.9,
  total: 19.9,
}), [{ category: "Pay by Bank", amount: 19.9 }]);

assert.throws(
  () => getSalesPaymentAllocations({ ...splitOrder, posPaymentBreakdown: [{ method: "indy", amount: 10 }] }),
  /sans ventilation de paiement valide/,
);

const customRange = resolveSalesDashboardPeriod({
  period: "custom",
  startDate: "2026-08-01",
  endDate: "2026-08-31",
});
assert.equal(customRange.start.toISOString(), "2026-08-01T00:00:00.000Z");
assert.equal(customRange.end.toISOString(), "2026-09-01T00:00:00.000Z");

console.log("✓ Statistiques de ventes : périodes et ventilation DIVISER validées");

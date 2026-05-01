import assert from "node:assert/strict";
import { getPaymentProvider } from "./paymentRouter";

const cases = [
  { input: { method: "paypal" as const }, expected: "paypal" },
  { input: { method: "bank_transfer" as const }, expected: "fintecture" },
  { input: { method: "sepa_debit" as const, isB2B: true }, expected: "gocardless" },
  { input: { method: "sepa_debit" as const, isB2B: false }, expected: "checkout" },
  { input: { method: "card" as const, cardCountry: "FR" }, expected: "mollie" },
  { input: { method: "card" as const, cardCountry: " be " }, expected: "mollie" },
  { input: { method: "card" as const, cardCountry: "US" }, expected: "checkout" },
  { input: { method: "card" as const }, expected: "checkout" },
];

for (const testCase of cases) {
  assert.equal(getPaymentProvider(testCase.input), testCase.expected, JSON.stringify(testCase.input));
}

console.log("paymentRouter regression tests passed");

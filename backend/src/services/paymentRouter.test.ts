import assert from "node:assert/strict";
import { getAvailableMethods, getPaymentProvider } from "./paymentRouter";

assert.deepEqual(getAvailableMethods("FR", false), [
  "card",
  "pay_by_bank",
  "paypal_4x",
  "apple_pay",
  "google_pay",
  "sepa",
]);

assert.deepEqual(getAvailableMethods("BE", false), [
  "card",
  "pay_by_bank",
  "paypal_4x",
  "apple_pay",
  "google_pay",
  "sepa",
  "bancontact",
]);

assert.deepEqual(getAvailableMethods("NL", false), [
  "card",
  "pay_by_bank",
  "paypal_4x",
  "apple_pay",
  "google_pay",
  "sepa",
  "ideal",
]);

assert.deepEqual(getAvailableMethods("US", false), ["card_international"]);
assert.deepEqual(getAvailableMethods("FR", true), ["pay_by_bank", "sepa"]);
assert.deepEqual(getAvailableMethods("US", true), []);

assert.equal(getPaymentProvider({ method: "card", country: "FR", isB2B: false }), "mollie");
assert.equal(getPaymentProvider({ method: "bancontact", country: "BE", isB2B: false }), "mollie");
assert.equal(getPaymentProvider({ method: "paypal_4x", country: "FR", isB2B: false }), "paypal");
assert.equal(getPaymentProvider({ method: "card_international", country: "US", isB2B: false }), "checkout");
assert.equal(getPaymentProvider({ method: "pay_by_bank", country: "FR", isB2B: true }), "mollie");
assert.equal(getPaymentProvider({ method: "sepa", country: "FR", isB2B: true }), "mollie");
assert.equal(getAvailableMethods("US", true).includes("sepa"), false);

console.log("paymentRouter regression tests passed");

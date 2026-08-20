import assert from "node:assert/strict";
import {
  assertSupportedPaymentMethod,
  getAvailableMethods,
  getMollieLocale,
  getPaymentProvider,
  MOLLIE_METHOD_MAP,
  normalizeCountry,
} from "./paymentRouter";

const b2cCommon = [
  "card",
  "paybybank",
  "paypal",
  ...(process.env.PAYPAL_PAY_LATER_ENABLED === "true" ? ["paypal_4x"] : []),
  "apple_pay",
  "google_pay",
];

const originalCardSurcharge = process.env.B2B_CARD_SURCHARGE_PERCENT;
const originalPaypalSurcharge = process.env.B2B_PAYPAL_SURCHARGE_PERCENT;

function restoreEnv(name: "B2B_CARD_SURCHARGE_PERCENT" | "B2B_PAYPAL_SURCHARGE_PERCENT", value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

try {
  // Les assertions de régression doivent être indépendantes de la configuration locale/Render.
  delete process.env.B2B_CARD_SURCHARGE_PERCENT;
  delete process.env.B2B_PAYPAL_SURCHARGE_PERCENT;

  // B2C : seules les méthodes réellement proposées au checkout sont attendues.
  assert.deepEqual(getAvailableMethods("FR", false), b2cCommon);
  assert.deepEqual(getAvailableMethods("BE", false), [...b2cCommon, "bancontact"]);
  assert.deepEqual(getAvailableMethods("NL", false), [...b2cCommon, "ideal"]);
  assert.deepEqual(getAvailableMethods("PL", false), [...b2cCommon, "blik"]);
  assert.deepEqual(getAvailableMethods("PT", false), [...b2cCommon, "mb_way", "multibanco"]);

  // B2B : l’option recommandée est seule visible tant qu’aucun taux n’est explicitement défini.
  assert.deepEqual(getAvailableMethods("FR", true), ["paybybank"]);
  assert.deepEqual(getAvailableMethods("BE", true), ["paybybank"]);
  assert.equal(getAvailableMethods("FR", true).includes("sepa"), false);
  assert.equal(getAvailableMethods("FR", true).includes("pay_by_bank"), false);

  // L’activation progressive respecte l’ordre : sans frais, carte, puis portefeuille.
  process.env.B2B_CARD_SURCHARGE_PERCENT = "1.75";
  assert.deepEqual(getAvailableMethods("FR", true), ["paybybank", "card"]);
  process.env.B2B_PAYPAL_SURCHARGE_PERCENT = "3.4";
  assert.deepEqual(getAvailableMethods("FR", true), ["paybybank", "card", "paypal"]);

  // Hors EEE : aucune option en ligne ne doit être rendue disponible.
  assert.deepEqual(getAvailableMethods("US", false), []);
  assert.deepEqual(getAvailableMethods("US", true), []);

  // Les alias historiques restent routables pour les anciennes commandes, mais ne sont plus proposés.
  assert.equal(getPaymentProvider({ method: "paybybank", country: "FR", isB2B: false }), "mollie");
  assert.equal(getPaymentProvider({ method: "pay_by_bank", country: "FR", isB2B: true }), "mollie");
  assert.equal(getPaymentProvider({ method: "sepa", country: "FR", isB2B: false }), "mollie");
  assert.equal(getPaymentProvider({ method: "paypal", country: "FR", isB2B: false }), "paypal");
  assert.equal(getPaymentProvider({ method: "paypal_4x", country: "FR", isB2B: false }), "paypal");
  assert.equal(getPaymentProvider({ method: "bancontact", country: "BE", isB2B: false }), "mollie");

  assert.deepEqual(MOLLIE_METHOD_MAP.paybybank, ["paybybank"]);
  assert.deepEqual(MOLLIE_METHOD_MAP.pay_by_bank, ["banktransfer"]);
  assert.deepEqual(MOLLIE_METHOD_MAP.sepa, ["directdebit"]);
  assert.deepEqual(MOLLIE_METHOD_MAP.card, ["creditcard"]);
  assert.deepEqual(MOLLIE_METHOD_MAP.ideal, ["ideal"]);

  assert.equal(normalizeCountry(" fr "), "FR");
  assert.equal(getMollieLocale("NL"), "nl_NL");
  assert.equal(getMollieLocale("unknown"), "fr_FR");
  assert.doesNotThrow(() => assertSupportedPaymentMethod("paybybank"));
  assert.doesNotThrow(() => assertSupportedPaymentMethod("pay_by_bank"));
  assert.throws(() => assertSupportedPaymentMethod("split"), /non supportée/i);
} finally {
  restoreEnv("B2B_CARD_SURCHARGE_PERCENT", originalCardSurcharge);
  restoreEnv("B2B_PAYPAL_SURCHARGE_PERCENT", originalPaypalSurcharge);
}

console.log("✓ Tests de régression du routeur de paiement validés");

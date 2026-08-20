import assert from "node:assert/strict";
import {
  calculateB2BSurcharge,
  getB2BConfiguredSurcharges,
  getB2BSurchargePercent,
  isB2BMethodEnabled,
} from "./b2bPaymentSurchargeService";

const originalCard = process.env.B2B_CARD_SURCHARGE_PERCENT;
const originalPaypal = process.env.B2B_PAYPAL_SURCHARGE_PERCENT;

function restoreEnv(name: "B2B_CARD_SURCHARGE_PERCENT" | "B2B_PAYPAL_SURCHARGE_PERCENT", value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

try {
  delete process.env.B2B_CARD_SURCHARGE_PERCENT;
  delete process.env.B2B_PAYPAL_SURCHARGE_PERCENT;

  assert.equal(getB2BSurchargePercent("card"), 0);
  assert.equal(isB2BMethodEnabled("card"), false);
  assert.deepEqual(getB2BConfiguredSurcharges(), {});

  process.env.B2B_CARD_SURCHARGE_PERCENT = "1,75";
  assert.equal(getB2BSurchargePercent("card"), 1.75);
  assert.equal(isB2BMethodEnabled("card"), true);

  const cardSurcharge = calculateB2BSurcharge(100, 20, "card");
  assert.deepEqual(cardSurcharge, {
    percent: 1.75,
    feeHT: 1.75,
    feeVatRate: 20,
    feeVatAmount: 0.35,
    feeTTC: 2.1,
    totalWithFeeTTC: 122.1,
  });

  process.env.B2B_PAYPAL_SURCHARGE_PERCENT = "3.4";
  assert.deepEqual(getB2BConfiguredSurcharges(), { card: 1.75, paypal: 3.4 });

  const zeroVatSurcharge = calculateB2BSurcharge(100, 0, "paypal");
  assert.deepEqual(zeroVatSurcharge, {
    percent: 3.4,
    feeHT: 3.4,
    feeVatRate: 0,
    feeVatAmount: 0,
    feeTTC: 3.4,
    totalWithFeeTTC: 103.4,
  });

  process.env.B2B_CARD_SURCHARGE_PERCENT = "0";
  assert.equal(isB2BMethodEnabled("card"), false);
  assert.equal(calculateB2BSurcharge(100, 20, "card").feeTTC, 0);

  process.env.B2B_PAYPAL_SURCHARGE_PERCENT = "101";
  assert.equal(isB2BMethodEnabled("paypal"), false);
} finally {
  restoreEnv("B2B_CARD_SURCHARGE_PERCENT", originalCard);
  restoreEnv("B2B_PAYPAL_SURCHARGE_PERCENT", originalPaypal);
}

console.log("✓ Tests de régression des frais de paiement B2B validés");

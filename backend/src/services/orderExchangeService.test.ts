import assert from "node:assert/strict";
import { calculateOrderExchangeFinancials, isOrderExchangeEligible, usesProfessionalExchangePricing } from "./orderExchangeService";

function testB2CWithLineDiscount() {
  const result = calculateOrderExchangeFinancials({
    returnedUnitPrice: 10,
    returnedLineDiscount: 2,
    returnedLineQuantity: 2,
    exchangeQuantity: 1,
    replacementPublicUnitPrice: 15,
    isB2B: false,
    vatRate: 20,
  });

  assert.deepEqual(result, {
    allocatedReturnDiscount: 1,
    returnValue: 9,
    replacementUnitPrice: 15,
    replacementValue: 15,
    differenceAmount: 6,
  });
}

function testB2BUsesProfessionalHtPrice() {
  const result = calculateOrderExchangeFinancials({
    returnedUnitPrice: 30,
    returnedLineDiscount: 0,
    returnedLineQuantity: 1,
    exchangeQuantity: 1,
    replacementPublicUnitPrice: 60,
    replacementProfessionalUnitPrice: 40,
    isB2B: true,
    vatRate: 20,
  });

  assert.equal(result.returnValue, 30);
  assert.equal(result.replacementUnitPrice, 40);
  assert.equal(result.differenceAmount, 10);
}

function testPosExchangeEligibility() {
  assert.equal(isOrderExchangeEligible({ status: "paid", channel: "pos", noShipping: true }), true);
  assert.equal(isOrderExchangeEligible({ status: "shipped", channel: "pos", noShipping: true }), true);
  assert.equal(isOrderExchangeEligible({ status: "paid", channel: "online", noShipping: false }), false);
  assert.equal(isOrderExchangeEligible({ status: "shipped", channel: "online", noShipping: true }), false);
  assert.equal(isOrderExchangeEligible({ status: "delivered", channel: "online", noShipping: false }), true);
}

function testPosOrderUsesTtcEvenForProfessionalCustomer() {
  assert.equal(usesProfessionalExchangePricing({ isB2B: true, channel: "pos" }), false);
  assert.equal(usesProfessionalExchangePricing({ isB2B: true, channel: "online" }), true);
  assert.equal(usesProfessionalExchangePricing({ isB2B: false, channel: "online" }), false);

  const result = calculateOrderExchangeFinancials({
    returnedUnitPrice: 259,
    returnedLineDiscount: 0,
    returnedLineQuantity: 1,
    exchangeQuantity: 1,
    replacementPublicUnitPrice: 299,
    replacementProfessionalUnitPrice: 249.17,
    // Une vente POS rattachée à un compte pro transmet false à ce calcul :
    // ses lignes ont déjà été vendues et enregistrées TTC.
    isB2B: usesProfessionalExchangePricing({ isB2B: true, channel: "pos" }),
    vatRate: 20,
  });

  assert.equal(result.returnValue, 259);
  assert.equal(result.replacementValue, 299);
  assert.equal(result.differenceAmount, 40);
}

function testB2BFallbackPublicTtcToHt() {
  const result = calculateOrderExchangeFinancials({
    returnedUnitPrice: 50,
    returnedLineDiscount: 0,
    returnedLineQuantity: 1,
    exchangeQuantity: 1,
    replacementPublicUnitPrice: 48,
    replacementProfessionalUnitPrice: null,
    isB2B: true,
    vatRate: 20,
  });

  assert.equal(result.replacementUnitPrice, 40);
  assert.equal(result.differenceAmount, -10);
}

function testHigherPricedReplacementRequiresExactComplement() {
  const result = calculateOrderExchangeFinancials({
    returnedUnitPrice: 259,
    returnedLineDiscount: 0,
    returnedLineQuantity: 1,
    exchangeQuantity: 1,
    replacementPublicUnitPrice: 299,
    isB2B: false,
    vatRate: 20,
  });

  assert.equal(result.returnValue, 259);
  assert.equal(result.replacementValue, 299);
  assert.equal(result.differenceAmount, 40);
}

testB2CWithLineDiscount();
testB2BUsesProfessionalHtPrice();
testB2BFallbackPublicTtcToHt();
testHigherPricedReplacementRequiresExactComplement();
testPosExchangeEligibility();
testPosOrderUsesTtcEvenForProfessionalCustomer();
console.log("✓ Calculs financiers et éligibilité POS d’échange validés");

import assert from "node:assert/strict";
import { calculateOrderExchangeFinancials, isOrderExchangeEligible } from "./orderExchangeService";

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

testB2CWithLineDiscount();
testB2BUsesProfessionalHtPrice();
testB2BFallbackPublicTtcToHt();
testPosExchangeEligibility();
console.log("✓ Calculs financiers et éligibilité POS d’échange validés");

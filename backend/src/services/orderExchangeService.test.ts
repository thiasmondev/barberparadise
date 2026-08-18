import assert from "node:assert/strict";
import { calculateOrderExchangeFinancials } from "./orderExchangeService";

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
console.log("✓ Calculs financiers d’échange validés");

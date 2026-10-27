import assert from "node:assert/strict";
import { resolveProfessionalPricing } from "./b2bPricingService";

function resolve(items: Parameters<typeof resolveProfessionalPricing>[0]["items"]) {
  return resolveProfessionalPricing({ isB2B: true, vatRate: 20, items });
}

function testBelowThresholdUsesRetail() {
  const result = resolve([{ productId: "clipper", quantity: 1, publicUnitTTC: 120, ownProfessionalUnitHT: 80 }]);
  assert.equal(result.pricingTier, "retail");
  assert.equal(result.qualifyingSubtotalHT, 80);
  assert.equal(result.remainingHT, 120);
  assert.equal(result.lines[0].appliedUnitHT, 100);
  assert.equal(result.lines[0].appliedUnitTTC, 120);
  assert.equal(result.lines[0].priceSource, "retail");
}

function testThresholdAndMixedPrices() {
  const result = resolve([
    { productId: "eligible", quantity: 2, publicUnitTTC: 180, ownProfessionalUnitHT: 100 },
    { productId: "retail-only", quantity: 1, publicUnitTTC: 60, ownProfessionalUnitHT: null },
  ]);
  assert.equal(result.qualifyingSubtotalHT, 250);
  assert.equal(result.pricingTier, "pro");
  assert.equal(result.lines[0].appliedUnitHT, 100);
  assert.equal(result.lines[0].priceSource, "pro");
  assert.equal(result.lines[1].appliedUnitHT, 50);
  assert.equal(result.lines[1].appliedUnitTTC, 60);
  assert.equal(result.lines[1].priceSource, "retail");
}

function testOwnVariantPriceIsRequired() {
  const result = resolve([
    // The parent may have a price, but the selected variant explicitly has none.
    { productId: "product", variantId: "variant-without-pro", quantity: 4, publicUnitTTC: 60, ownProfessionalUnitHT: null },
  ]);
  assert.equal(result.pricingTier, "pro");
  assert.equal(result.lines[0].proUnitHT, null);
  assert.equal(result.lines[0].appliedUnitHT, 50);
  assert.equal(result.lines[0].priceSource, "retail");
}

function testB2CAlwaysUsesRetail() {
  const result = resolveProfessionalPricing({
    isB2B: false,
    vatRate: 20,
    items: [{ productId: "product", quantity: 2, publicUnitTTC: 150, ownProfessionalUnitHT: 90 }],
  });
  assert.equal(result.pricingTier, "retail");
  assert.equal(result.lines[0].appliedUnitTTC, 150);
  assert.equal(result.lines[0].priceSource, "retail");
}

testBelowThresholdUsesRetail();
testThresholdAndMixedPrices();
testOwnVariantPriceIsRequired();
testB2CAlwaysUsesRetail();
console.log("✓ Tarification professionnelle par seuil validée");

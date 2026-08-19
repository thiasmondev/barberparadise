import assert from "node:assert/strict";
import {
  DEFERRED_DRAFT_PAYMENT_METHOD,
  isDeferredDraftPaymentMethod,
  resolveDraftPaymentMethod,
} from "./draftPaymentService";

// Le paiement ultérieur est identique en B2C et B2B : la tarification ne doit pas influer sur son enregistrement.
assert.equal(resolveDraftPaymentMethod({ paymentLater: true }), DEFERRED_DRAFT_PAYMENT_METHOD);
assert.equal(resolveDraftPaymentMethod({ paymentLater: false }), "card");

// Un PATCH incomplet ne doit pas écraser un paiement différé existant.
assert.equal(
  resolveDraftPaymentMethod({ currentPaymentMethod: DEFERRED_DRAFT_PAYMENT_METHOD }),
  DEFERRED_DRAFT_PAYMENT_METHOD,
);
assert.equal(resolveDraftPaymentMethod({ currentPaymentMethod: "card" }), "card");
assert.equal(isDeferredDraftPaymentMethod(DEFERRED_DRAFT_PAYMENT_METHOD), true);
assert.equal(isDeferredDraftPaymentMethod("card"), false);

console.log("✓ Paiement ultérieur des brouillons B2C/B2B validé");

export const DEFERRED_DRAFT_PAYMENT_METHOD = "b2b_deferred";

/**
 * Détermine le moyen de paiement d'un brouillon créé par l'administration.
 * Le nom technique b2b_deferred est historique, mais représente le paiement
 * ultérieur quel que soit le profil tarifaire (B2C ou B2B).
 */
export function resolveDraftPaymentMethod(params: {
  paymentLater?: unknown;
  currentPaymentMethod?: string | null;
}): string {
  if (typeof params.paymentLater === "boolean") {
    return params.paymentLater ? DEFERRED_DRAFT_PAYMENT_METHOD : "card";
  }

  // Un PATCH qui ne transporte pas cette propriété ne doit jamais faire
  // basculer silencieusement une commande différée vers card.
  return params.currentPaymentMethod || "card";
}

export function isDeferredDraftPaymentMethod(paymentMethod?: string | null): boolean {
  return paymentMethod === DEFERRED_DRAFT_PAYMENT_METHOD;
}

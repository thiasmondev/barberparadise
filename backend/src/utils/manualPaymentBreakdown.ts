export const MANUAL_PAYMENT_METHODS = [
  "external_card",
  "indy",
  "mollie_manual",
  "cash",
  "virement",
  "other",
] as const;

export type ManualPaymentMethod = typeof MANUAL_PAYMENT_METHODS[number];

export type ManualPaymentSplitLine = {
  method: ManualPaymentMethod;
  amount: number;
};

export function manualPaymentMoney(value: number): number {
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

export function isManualPaymentMethod(value: unknown): value is ManualPaymentMethod {
  return typeof value === "string" && (MANUAL_PAYMENT_METHODS as readonly string[]).includes(value);
}

export function getManualPaymentMethodLabel(method: ManualPaymentMethod): string {
  switch (method) {
    case "external_card":
      return "Carte via lien externe";
    case "indy":
      return "Indy";
    case "mollie_manual":
      return "Carte manuelle";
    case "cash":
      return "Espèces";
    case "virement":
      return "Virement bancaire";
    case "other":
      return "Autre moyen";
  }
}

/**
 * Valide une ventilation d'encaissement réellement constaté. Le total attendu
 * est fourni par le serveur : les montants client ne sont jamais utilisés seuls.
 */
export function validateManualPaymentSplitLines(
  rawLines: unknown,
  expectedTotal: number,
  options: { minimumLines?: number } = {},
): ManualPaymentSplitLine[] {
  const minimumLines = options.minimumLines ?? 2;
  if (!Array.isArray(rawLines) || rawLines.length < minimumLines) {
    throw new Error(`Le paiement divisé nécessite au moins ${minimumLines} ligne${minimumLines > 1 ? "s" : ""}.`);
  }

  const lines = rawLines.map((rawLine, index) => {
    if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) {
      throw new Error(`Ligne de paiement ${index + 1} invalide.`);
    }

    const line = rawLine as { method?: unknown; amount?: unknown };
    const method = typeof line.method === "string" ? line.method.trim().toLowerCase() : "";
    const amount = manualPaymentMoney(Number(line.amount));
    if (!isManualPaymentMethod(method)) {
      throw new Error(`Moyen de paiement invalide en ligne ${index + 1}.`);
    }
    if (amount <= 0) {
      throw new Error(`Le montant de la ligne ${index + 1} doit être supérieur à 0 €.`);
    }
    return { method, amount };
  });

  const expected = manualPaymentMoney(expectedTotal);
  const allocated = manualPaymentMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  if (Math.abs(allocated - expected) > 0.01) {
    throw new Error(`La somme des lignes (${allocated.toFixed(2)} €) ne correspond pas au montant à confirmer (${expected.toFixed(2)} €).`);
  }

  return lines;
}

export const POS_REAL_PAYMENT_METHODS = ["indy", "mollie_manual", "cash", "virement"] as const;

export type PosRealPaymentMethod = typeof POS_REAL_PAYMENT_METHODS[number];

export type PosPaymentAllocation = {
  method: PosRealPaymentMethod;
  amount: number;
};

type PosPaymentSource = {
  paymentMethod?: string | null;
  posPaymentBreakdown?: unknown;
  totalTTC?: number | null;
  total?: number | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRealPaymentMethod(value: unknown): value is PosRealPaymentMethod {
  return typeof value === "string" && (POS_REAL_PAYMENT_METHODS as readonly string[]).includes(value);
}

function getOrderTotal(source: PosPaymentSource): number {
  const totalTTC = Number(source.totalTTC || 0);
  if (Number.isFinite(totalTTC) && totalTTC > 0) return money(totalTTC);
  const total = Number(source.total || 0);
  return money(Number.isFinite(total) ? total : 0);
}

/**
 * Retourne les composantes réelles d'un paiement POS DIVISER.
 * Une ventilation invalide renvoie null : les rapports ne doivent jamais inventer
 * une répartition comptable lorsqu'aucun détail fiable n'a été enregistré.
 */
export function getPosSplitAllocations(source: PosPaymentSource): PosPaymentAllocation[] | null {
  if ((source.paymentMethod || "").toLowerCase() !== "split") return null;
  if (!Array.isArray(source.posPaymentBreakdown) || source.posPaymentBreakdown.length < 2) return null;

  const allocations: PosPaymentAllocation[] = [];
  for (const rawLine of source.posPaymentBreakdown) {
    if (!rawLine || typeof rawLine !== "object" || Array.isArray(rawLine)) return null;
    const line = rawLine as { method?: unknown; amount?: unknown };
    const amount = money(Number(line.amount || 0));
    if (!isRealPaymentMethod(line.method) || amount <= 0) return null;
    allocations.push({ method: line.method, amount });
  }

  const expectedTotal = getOrderTotal(source);
  const allocationsTotal = money(allocations.reduce((sum, allocation) => sum + allocation.amount, 0));
  if (Math.abs(allocationsTotal - expectedTotal) > 0.01) return null;

  return allocations;
}

export function getPosPaymentMethodLabel(method: PosRealPaymentMethod): string {
  switch (method) {
    case "indy":
      return "Indy";
    case "mollie_manual":
      return "Mollie";
    case "cash":
      return "Espèces";
    case "virement":
      return "Virement";
  }
}

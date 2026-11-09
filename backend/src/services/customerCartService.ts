import { Prisma } from "@prisma/client";
import { normalizeEmailAddress } from "../utils/emailValidation";

export function customerCartWhere(email: string): Prisma.AbandonedCartSessionWhereInput {
  return {
    email: { equals: normalizeEmailAddress(email), mode: "insensitive" },
    convertedAt: null,
    itemCount: { gt: 0 },
  };
}

export function cartBelongsToCustomer(cartEmail: string | null, customerEmail: string): boolean {
  return Boolean(cartEmail) && normalizeEmailAddress(cartEmail) === normalizeEmailAddress(customerEmail);
}

export function cartHasItemSnapshot(body: { cartItems?: unknown }): boolean {
  // An omitted snapshot only updates identity; an explicit [] empties the cart.
  return Array.isArray(body.cartItems);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type TrackingProduct = {
  id: string;
  name: string;
  price: number;
  variants: Array<{ id: string; name: string; price: number | null }>;
};

/** Tracking is not checkout: unresolved references stay visible, never choose a variant. */
export function buildTrackedCartSnapshot(
  lines: Array<{ productId: string; variantId: string | null; quantity: number }>,
  products: TrackingProduct[],
) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = lines.map((line) => {
    const product = byId.get(line.productId);
    const variant = product && line.variantId ? product.variants.find((candidate) => candidate.id === line.variantId) : null;
    const validationIssue = !product
      ? "Article absent du catalogue : à vérifier avant conversion."
      : (line.variantId && !variant) || (product.variants.length > 0 && !variant)
        ? "Variante à sélectionner ou à vérifier avant conversion."
        : null;
    return {
      productId: line.productId,
      name: product?.name || "Article à vérifier",
      variantId: line.variantId,
      variantLabel: variant?.name || null,
      price: variant?.price ?? product?.price ?? 0,
      quantity: line.quantity,
      validationIssue,
    };
  });
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: money(items.reduce((sum, item) => sum + item.price * item.quantity, 0)),
    validationIssues: [...new Set(items.flatMap((item) => item.validationIssue ? [item.validationIssue] : []))],
  };
}

export function serializeCustomerCartItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const line = raw as Record<string, unknown>;
    const productId = typeof line.productId === "string" ? line.productId : typeof line.id === "string" ? line.id : "";
    const quantity = Number(line.quantity);
    const price = Number(line.price);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return [];
    return [{
      productId,
      variantId: typeof line.variantId === "string" && line.variantId ? line.variantId : null,
      name: typeof line.name === "string" ? line.name : "Article",
      variantLabel: typeof line.variantLabel === "string" ? line.variantLabel : null,
      quantity,
      price,
      lineTotal: money(price * quantity),
      ...(typeof line.validationIssue === "string" && line.validationIssue ? { validationIssue: line.validationIssue } : {}),
    }];
  });
}

/** Called inside the same Prisma transaction as draft creation; rollback on failure. */
export async function claimCartForDraft(
  tx: Pick<Prisma.TransactionClient, "abandonedCartSession">,
  cart: { id: string; updatedAt: Date },
): Promise<void> {
  const claim = await tx.abandonedCartSession.updateMany({
    where: { id: cart.id, convertedAt: null, itemCount: { gt: 0 }, updatedAt: cart.updatedAt },
    data: { convertedAt: new Date() },
  });
  if (claim.count !== 1) {
    throw new Error("Ce panier a été modifié ou déjà transformé en brouillon. Actualisez la liste avant de réessayer.");
  }
}

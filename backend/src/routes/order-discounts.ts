import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth";
import { prisma } from "../utils/prisma";
import { calculateOrderDiscountCorrection, getOrderDiscountForm, type OrderDiscountPayload } from "../services/orderDiscountService";

export const orderDiscountsRouter = Router();
const editableStatuses = new Set(["draft", "paid", "processing", "shipped", "delivered", "partially_refunded", "pending", "pending_payment", "open"]);
const includeOrder = { items: true, exchanges: { select: { id: true, status: true } }, shippingAddress: true, shipment: true, customer: { include: { addresses: true, _count: { select: { orders: true } } } } } as const;

async function loadEditableOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: includeOrder });
  if (!order) throw Object.assign(new Error("Commande introuvable."), { status: 404 });
  if (!editableStatuses.has(order.status)) throw Object.assign(new Error("Les remises ne peuvent pas être corrigées avec le statut actuel de cette commande."), { status: 409 });
  if (order.exchanges.some((exchange) => exchange.status !== "cancelled")) {
    throw Object.assign(new Error("Un échange est associé à cette commande. Ses montants doivent être vérifiés avant de modifier les remises d’origine."), { status: 409 });
  }
  if (order.pendingComplementPaymentId || Number(order.pendingComplementAmount || 0) > 0 ||
    (["pending", "pending_payment", "open"].includes(order.status) && order.providerPaymentId && order.paymentProvider !== "manual")) {
    throw Object.assign(new Error("Un lien de paiement est encore actif. Vérifiez son annulation avant de modifier le montant de la commande."), { status: 409 });
  }
  return order;
}
function sendError(res: Response, error: unknown) {
  const typed = error as Error & { status?: number };
  res.status(typed.status || 400).json({ error: typed.message || "Impossible de corriger les remises." });
}
function assertVersion(expected: unknown, actual: Date) {
  if (typeof expected !== "string" || !Number.isFinite(Date.parse(expected)) || Date.parse(expected) !== actual.getTime()) {
    throw Object.assign(new Error("La commande a changé. Fermez puis rouvrez la correction des remises pour vérifier les derniers montants."), { status: 409 });
  }
}

orderDiscountsRouter.get("/orders/:id/discounts", requireAdmin, async (req: Request, res: Response) => {
  try { res.json(getOrderDiscountForm(await loadEditableOrder(req.params.id))); }
  catch (error) { sendError(res, error); }
});
orderDiscountsRouter.post("/orders/:id/discounts/preview", requireAdmin, async (req: Request, res: Response) => {
  try {
    const order = await loadEditableOrder(req.params.id);
    const input = req.body as OrderDiscountPayload;
    assertVersion(input.expectedUpdatedAt, order.updatedAt);
    const { lines: _lines, ...preview } = calculateOrderDiscountCorrection(order, input);
    res.json(preview);
  } catch (error) { sendError(res, error); }
});
orderDiscountsRouter.patch("/orders/:id/discounts", requireAdmin, async (req: Request, res: Response) => {
  try {
    const order = await loadEditableOrder(req.params.id);
    const input = req.body as OrderDiscountPayload;
    assertVersion(input.expectedUpdatedAt, order.updatedAt);
    const correction = calculateOrderDiscountCorrection(order, input);
    const at = new Date();
    const note = `[Correction remises — ${at.toISOString()}]\nTotal : ${order.total.toFixed(2)} → ${correction.newTotal.toFixed(2)} ${order.currency}. Montant encaissé inchangé.\nRemise globale : ${correction.orderDiscountType || "aucune"} ${correction.orderDiscountValue ?? 0}.\nLignes : ${correction.lines.map((line) => `${line.id} : ${line.lineDiscountType || "aucune"} ${line.lineDiscountValue ?? 0}`).join(" ; ")}`;
    await prisma.$transaction(async (tx) => {
      // Optimistic lock also detects intervening webhooks or another administrator.
      const locked = await tx.order.updateMany({
        where: { id: order.id, updatedAt: order.updatedAt },
        data: {
          subtotal: correction.subtotal, total: correction.newTotal, totalHT: correction.totalHT,
          vatAmount: correction.vatAmount, totalTTC: correction.totalTTC,
          discountAmount: correction.discountTotal, discountTotal: correction.discountTotal,
          orderDiscountType: correction.orderDiscountType, orderDiscountValue: correction.orderDiscountValue,
          itemsLastModifiedAt: at, notes: order.notes ? `${order.notes}\n\n${note}` : note,
        },
      });
      if (locked.count !== 1) throw Object.assign(new Error("La commande a changé pendant la correction. Actualisez avant de réessayer."), { status: 409 });
      for (const line of correction.lines) {
        await tx.orderItem.update({ where: { id: line.id }, data: {
          discountAmount: line.discountAmount, lineDiscountType: line.lineDiscountType, lineDiscountValue: line.lineDiscountValue,
        } });
      }
    });
    const updated = await prisma.order.findUnique({ where: { id: order.id }, include: includeOrder });
    const { lines: _lines, ...preview } = correction;
    res.json({ order: updated, ...preview });
  } catch (error) { sendError(res, error); }
});

import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";
import { prisma } from "../utils/prisma";
import { orderDiscountsRouter } from "../routes/order-discounts";
import { calculateOrderDiscountCorrection, getSavedOrderDiscount, type SavedDiscountOrder } from "./orderDiscountService";

async function run() {
  const initial: SavedDiscountOrder = {
    id: "order-test", updatedAt: new Date("2026-11-09T10:00:00Z"), total: 190, shipping: 0,
    isB2B: false, channel: "online", status: "paid", vatRate: 20, paidAmount: 190, refundedAmount: 0,
    discountAmount: 10, discountTotal: 10, orderDiscountType: null, orderDiscountValue: null,
    items: [{ id: "line-a", name: "Article test", price: 100, quantity: 2, discountAmount: 10, lineDiscountType: "fixed", lineDiscountValue: 10 }],
  };
  assert.deepEqual(getSavedOrderDiscount(initial), { type: null, value: null }, "Aggregate line discount is not a new global reduction");
  assert.deepEqual(getSavedOrderDiscount({ ...initial, discountAmount: 15, discountTotal: 15 }), { type: "fixed", value: 5 }, "Legacy residual global discount is retained");
  assert.deepEqual(getSavedOrderDiscount({ ...initial, discountAmount: 15, discountTotal: 15, orderDiscountValue: 0 }), { type: null, value: null }, "Explicit zero never restores an aggregate legacy reduction");
  const body = { items: [{ id: "line-a", lineDiscountType: "fixed", lineDiscountValue: 10 }], orderDiscountType: null, orderDiscountValue: null, expectedUpdatedAt: initial.updatedAt.toISOString() };
  const same = calculateOrderDiscountCorrection(initial, body);
  assert.equal(same.newTotal, 190, "10 EUR discount on quantity 2 is deducted ONCE, not twice");
  const percent = calculateOrderDiscountCorrection(initial, { ...body, items: [{ id: "line-a", lineDiscountType: "percent", lineDiscountValue: 10 }] });
  assert.equal(percent.newTotal, 180, "10% applies to the entire line worth 200 EUR");
  const twentyPercent = calculateOrderDiscountCorrection(initial, { ...body, items: [{ id: "line-a", lineDiscountType: "percent", lineDiscountValue: 20 }] });
  assert.equal(twentyPercent.newTotal, 160, "20% is applied once to the 200 EUR line, never copied globally");
  assert.equal(twentyPercent.discountTotal, 40);
  const restored = calculateOrderDiscountCorrection(initial, { ...body, items: [{ id: "line-a", lineDiscountType: null, lineDiscountValue: 0 }] });
  assert.equal(restored.newTotal, 200);
  assert.equal(restored.remainingAmount, 10);
  const global = calculateOrderDiscountCorrection(initial, { ...body, orderDiscountType: "fixed", orderDiscountValue: 5 });
  assert.equal(global.newTotal, 185);
  assert.equal(global.discountTotal, 15);
  assert.equal(global.overpaidAmount, 5);
  assert.throws(() => calculateOrderDiscountCorrection(initial, { ...body, items: [] }), /chaque ligne/);
  assert.throws(() => calculateOrderDiscountCorrection(initial, { ...body, items: [{ id: "foreign-line", lineDiscountType: "fixed", lineDiscountValue: 1 }] }), /inconnue/);
  assert.throws(() => calculateOrderDiscountCorrection(initial, { ...body, orderDiscountValue: -1 }), /invalide/);
  assert.throws(() => calculateOrderDiscountCorrection(initial, { ...body, orderDiscountType: "percent", orderDiscountValue: 101 }), /invalide/);
  const pos = calculateOrderDiscountCorrection({ ...initial, channel: "pos", isB2B: true }, body);
  assert.equal(pos.newTotal, 190, "POS professional customer still uses public TTC prices");
  assert.equal(pos.subtotal, 200, "POS gross subtotal convention is preserved");
  const pro = calculateOrderDiscountCorrection({ ...initial, isB2B: true, items: [{ ...initial.items[0], price: 100 }], shipping: 5, paymentFeeHT: 2, paymentFeeVatAmount: 0.4, paymentFeeTTC: 2.4 }, body);
  assert.equal(pro.newTotal, 235.4, "190 HT * 1.2 + 5 shipping + existing 2.4 TTC fee");
  assert.equal(pro.totalHT, 192);
  assert.equal(pro.vatAmount, 38.4);
  const quick = { ...initial, channel: "pos", orderDiscountType: "fixed", orderDiscountValue: 10, items: [{ ...initial.items[0], isCustomSale: true }] };
  assert.deepEqual(getSavedOrderDiscount(quick), { type: null, value: null }, "Historical quick-sale mirrored metadata is not applied twice");
  assert.equal(calculateOrderDiscountCorrection({ ...initial, paidAmount: null }, body).remainingAmount, null, "Unknown paid amount must not be invented");
  console.log("✓ Remises : € fixe une fois par ligne, %, résidu global, HT/TTC, frais inchangés et données invalides");

  process.env.ADMIN_JWT_SECRET = crypto.randomBytes(32).toString("hex");
  const token = jwt.sign({ id: "test-admin", role: "admin" }, process.env.ADMIN_JWT_SECRET);
  let order: any = { ...structuredClone(initial), exchanges: [], notes: "Note initiale", currency: "EUR", invoiceUrl: "original.pdf", providerPaymentId: null, pendingComplementPaymentId: null, pendingComplementAmount: null, paymentProvider: "manual" };
  const original = { find: prisma.order.findUnique, update: prisma.order.updateMany, line: prisma.orderItem.update, tx: prisma.$transaction };
  let writes = 0;
  let failLineUpdate = false;
  Object.assign(prisma.order, { findUnique: async ({ where }: any) => where.id === order.id ? structuredClone(order) : null });
  Object.assign(prisma.order, { updateMany: async ({ where, data }: any) => {
    if (where.updatedAt.getTime() !== order.updatedAt.getTime()) return { count: 0 };
    writes++;
    assert.equal("paidAmount" in data, false);
    assert.equal("refundedAmount" in data, false);
    assert.equal("status" in data, false);
    assert.equal("paymentFeeTTC" in data, false);
    order = { ...order, ...data, updatedAt: new Date(order.updatedAt.getTime() + 1000) };
    return { count: 1 };
  } });
  Object.assign(prisma.orderItem, { update: async ({ where, data }: any) => {
    if (failLineUpdate) throw new Error("Échec simulé");
    assert.deepEqual(Object.keys(data).sort(), ["discountAmount", "lineDiscountType", "lineDiscountValue"]);
    order.items = order.items.map((line: any) => line.id === where.id ? { ...line, ...data } : line);
    return order.items.find((line: any) => line.id === where.id);
  } });
  Object.assign(prisma, { $transaction: async (callback: any) => {
    const before = structuredClone(order);
    try { return await callback(prisma); }
    catch (error) { order = before; throw error; }
  } });
  const app = express(); app.use(express.json()); app.use("/api/admin", orderDiscountsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const url = "/api/admin/orders/order-test/discounts";
  async function request(path: string, method = "GET", payload?: unknown, authenticated = true) {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    return { status: response.status, body: await response.json() as any };
  }
  try {
    assert.equal((await request(url, "GET", undefined, false)).status, 401);
    assert.equal((await request("/api/admin/orders/missing/discounts")).status, 404);
    const loaded = await request(url);
    assert.equal(loaded.body.orderDiscountValue, null);
    const preview = await request(url + "/preview", "POST", body);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.newTotal, 190);
    assert.equal(writes, 0, "Preview makes no DB writes");
    assert.equal((await request(url, "PATCH", { ...body, expectedUpdatedAt: "2020-01-01" })).status, 409);
    assert.equal(writes, 0);
    const oldItems = structuredClone(order.items);
    const saved = await request(url, "PATCH", { ...body, orderDiscountType: "fixed", orderDiscountValue: 5 });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.newTotal, 185);
    assert.equal(saved.body.order.paidAmount, 190);
    assert.equal(saved.body.order.refundedAmount, 0);
    assert.equal(saved.body.order.status, "paid");
    assert.equal(saved.body.order.invoiceUrl, "original.pdf");
    assert.ok(saved.body.order.itemsLastModifiedAt);
    assert.equal(saved.body.order.items[0].id, oldItems[0].id);
    assert.equal(saved.body.order.items[0].price, oldItems[0].price);
    assert.equal(saved.body.order.items[0].quantity, oldItems[0].quantity);
    assert.equal((await request(url, "PATCH", body)).status, 409, "Repeated stale save cannot apply twice");
    const currentBody = { ...body, expectedUpdatedAt: order.updatedAt.toISOString() };
    failLineUpdate = true;
    const beforeFailure = structuredClone(order);
    assert.equal((await request(url, "PATCH", currentBody)).status, 400);
    assert.deepEqual(order, beforeFailure, "Transaction rolls back all amounts when a line write fails");
    failLineUpdate = false;
    order.pendingComplementPaymentId = "active-link";
    assert.equal((await request(url + "/preview", "POST", currentBody)).status, 409);
    order.pendingComplementPaymentId = null;
    order.exchanges = [{ id: "exchange", status: "completed" }];
    assert.equal((await request(url)).status, 409);
    order.exchanges = [];
    order.status = "refunded";
    assert.equal((await request(url, "PATCH", currentBody)).status, 409);
    console.log("✓ HTTP remises : autorisations, aperçu sans écriture, correction atomique, paiements/prix/stock immuables, facture signalée et verrouillage concurrent");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    Object.assign(prisma.order, { findUnique: original.find, updateMany: original.update });
    Object.assign(prisma.orderItem, { update: original.line });
    Object.assign(prisma, { $transaction: original.tx });
    await prisma.$disconnect();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });

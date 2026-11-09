import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { AddressInfo } from "node:net";
import { prisma } from "../utils/prisma";
import { adminRouter } from "../routes/admin";
import { checkoutRouter } from "../routes/checkout";

// Tests only: all DB delegates are replaced in this process, no live database used.
async function run() {
  process.env.ADMIN_JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  const adminToken = jwt.sign({ id: "test-admin", role: "admin" }, process.env.ADMIN_JWT_SECRET);
  const customerToken = jwt.sign({ id: "customer-a" }, process.env.JWT_SECRET);
  const customer = { id: "customer-a", email: "client@example.com", firstName: "Client", lastName: "Test", phone: "", proAccount: null, addresses: [] };
  let cart = {
    id: "cart-a", email: "CLIENT@example.com", itemCount: 2, total: 40,
    items: [{ productId: "clipper", name: "Tondeuse", variantId: "white", variantLabel: "Blanche", quantity: 2, price: 20 }],
    convertedAt: null as Date | null, convertedOrderId: null as string | null,
    updatedAt: new Date("2026-11-09T12:00:00Z"), lastSeenAt: new Date(),
  };
  let createdDraft: Record<string, unknown> | null = null;
  let createCount = 0;
  let failCreate = false;
  let lastCartQuery: Record<string, unknown> = {};
  let lastUpsert: { update: Record<string, unknown> } | null = null;
  const originals = {
    customerFind: prisma.customer.findUnique,
    cartFind: prisma.abandonedCartSession.findUnique,
    cartsFind: prisma.abandonedCartSession.findMany,
    cartClaim: prisma.abandonedCartSession.updateMany,
    cartUpdate: prisma.abandonedCartSession.update,
    cartUpsert: prisma.abandonedCartSession.upsert,
    products: prisma.product.findMany,
    orderCreate: prisma.order.create,
    orderFind: prisma.order.findUnique,
    transaction: prisma.$transaction,
  };
  function mock(target: object, key: string, fn: (...args: any[]) => any) {
    Object.assign(target, { [key]: fn });
  }
  mock(prisma.customer, "findUnique", async ({ where }) => where.id === "missing" ? null : customer);
  mock(prisma.abandonedCartSession, "findUnique", async () => cart);
  mock(prisma.abandonedCartSession, "findMany", async (query) => { lastCartQuery = query; return [cart]; });
  mock(prisma.abandonedCartSession, "updateMany", async () => {
    if (cart.convertedAt) return { count: 0 };
    cart.convertedAt = new Date();
    return { count: 1 };
  });
  mock(prisma.abandonedCartSession, "update", async ({ data }) => { Object.assign(cart, data); return cart; });
  mock(prisma.abandonedCartSession, "upsert", async (query) => { lastUpsert = query; return cart; });
  mock(prisma.product, "findMany", async () => [{
    id: "clipper", name: "Tondeuse", price: 25, priceProEur: null, status: "active", images: "[]", variants: [
      { id: "white", name: "Blanche", price: 30, priceProEur: null, image: "", inStock: true, stock: 10 },
    ],
  }]);
  mock(prisma.order, "create", async ({ data }) => {
    if (failCreate) throw new Error("Création simulée échouée");
    createCount++;
    createdDraft = { ...data, id: "draft-a", items: data.items.create };
    return createdDraft;
  });
  mock(prisma.order, "findUnique", async () => createdDraft);
  mock(prisma, "$transaction", async (callback) => {
    const before = { ...cart };
    try { return await callback(prisma); }
    catch (error) { cart = before; throw error; }
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  app.use("/api/checkout", checkoutRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(path: string, body?: unknown, token: string | null = adminToken) {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() as any };
  }
  try {
    assert.equal((await request("/api/admin/customers/customer-a/carts", undefined, null)).status, 401);
    assert.equal((await request("/api/admin/customers/missing/carts")).status, 404);
    const listed = await request("/api/admin/customers/customer-a/carts");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.carts[0].items[0].variantLabel, "Blanche");
    assert.deepEqual(lastCartQuery.where, { email: { equals: "client@example.com", mode: "insensitive" }, convertedAt: null, itemCount: { gt: 0 } });
    assert.deepEqual(lastCartQuery.orderBy, [{ lastSeenAt: "desc" }, { id: "asc" }]);

    const savedEmail = cart.email;
    cart.email = "another@example.com";
    assert.equal((await request("/api/admin/customers/customer-a/carts/cart-a/to-draft", {})).status, 404);
    assert.equal(createCount, 0);
    cart.email = savedEmail;

    failCreate = true;
    assert.equal((await request("/api/admin/customers/customer-a/carts/cart-a/to-draft", { shipping: 0 })).status, 400);
    assert.equal(cart.convertedAt, null, "Failed creation rolls back the conversion claim");
    failCreate = false;
    const converted = await request("/api/admin/customers/customer-a/carts/cart-a/to-draft", { shipping: 0, email: "override@example.com" });
    assert.equal(converted.status, 201);
    assert.equal(converted.body.draft.customerId, "customer-a");
    assert.equal(converted.body.draft.email, "client@example.com");
    assert.equal(converted.body.draft.status, "draft");
    assert.equal(converted.body.draft.items[0].variantId, "white");
    assert.equal(converted.body.draft.items[0].quantity, 2);
    assert.equal(converted.body.draft.items[0].price, 30, "Price recalculated from live variant, not old snapshot");
    assert.equal(converted.body.draft.pricingTier, "retail");
    assert.equal(cart.convertedOrderId, "draft-a");
    assert.equal((await request("/api/admin/customers/customer-a/carts/cart-a/to-draft", {})).status, 404);
    assert.equal(createCount, 1);

    cart.convertedAt = null;
    assert.equal((await request("/api/admin/orders/abandoned-carts/cart-a/to-draft", { shipping: 0 })).status, 201);
    assert.equal(createCount, 2, "Abandoned-cart export still uses the same handler");

    assert.equal((await request("/api/checkout/cart-session", { sessionId: "tracking", email: "client@example.com" }, null)).status, 200);
    assert.equal("items" in lastUpsert!.update, false);
    assert.equal("itemCount" in lastUpsert!.update, false);
    assert.equal((await request("/api/checkout/cart-session", { sessionId: "tracking", cartItems: [] }, null)).status, 200);
    assert.deepEqual(lastUpsert!.update.items, []);
    assert.equal(lastUpsert!.update.itemCount, 0);
    assert.equal((await request("/api/checkout/cart-session", { sessionId: "tracking", cartItems: "invalid" }, null)).status, 400);
    assert.equal((await request("/api/checkout/cart-session", { sessionId: "tracking", customerId: "customer-a" }, null)).status, 200);
    assert.equal("email" in lastUpsert!.update, false, "Unverified customerId does not resolve identity");
    assert.equal((await request("/api/checkout/cart-session", { sessionId: "tracking", email: "wrong@example.com" }, customerToken)).status, 200);
    assert.equal(lastUpsert!.update.email, "client@example.com", "Verified token resolves real customer email");
    console.log("✓ HTTP local : autorisations, appartenance, brouillon recalculé, anti-duplicata, rollback et synchronisation validés");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    mock(prisma.customer, "findUnique", originals.customerFind);
    mock(prisma.abandonedCartSession, "findUnique", originals.cartFind);
    mock(prisma.abandonedCartSession, "findMany", originals.cartsFind);
    mock(prisma.abandonedCartSession, "updateMany", originals.cartClaim);
    mock(prisma.abandonedCartSession, "update", originals.cartUpdate);
    mock(prisma.abandonedCartSession, "upsert", originals.cartUpsert);
    mock(prisma.product, "findMany", originals.products);
    mock(prisma.order, "create", originals.orderCreate);
    mock(prisma.order, "findUnique", originals.orderFind);
    mock(prisma, "$transaction", originals.transaction);
    await prisma.$disconnect();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });

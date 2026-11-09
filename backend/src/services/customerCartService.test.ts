import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { buildTrackedCartSnapshot, cartBelongsToCustomer, cartHasItemSnapshot, claimCartForDraft, customerCartWhere, serializeCustomerCartItems } from "./customerCartService";

async function run() {
  assert.deepEqual(customerCartWhere(" Client@Example.com "), {
    email: { equals: "client@example.com", mode: "insensitive" },
    convertedAt: null,
    itemCount: { gt: 0 },
  });
  // There is no lastSeenAt cutoff: active carts must be immediately visible.
  assert.equal("lastSeenAt" in customerCartWhere("client@example.com"), false);
  assert.equal(cartBelongsToCustomer("Client@Example.com", "client@example.com"), true);
  assert.equal(cartBelongsToCustomer("other@example.com", "client@example.com"), false);
  assert.equal(cartBelongsToCustomer(null, "client@example.com"), false);
  assert.equal(cartHasItemSnapshot({}), false);
  assert.equal(cartHasItemSnapshot({ cartItems: undefined }), false);
  assert.equal(cartHasItemSnapshot({ cartItems: [] }), true);
  assert.equal(cartHasItemSnapshot({ cartItems: "invalid" }), false);

  assert.deepEqual(serializeCustomerCartItems([
    { productId: "clipper", name: "Tondeuse", variantId: "white", variantLabel: "Blanche", quantity: 2, price: 19.99, privateData: "omitted" },
    { id: "comb", name: "Peigne", quantity: 1, price: 0 },
    null,
    { productId: "invalid", quantity: -1, price: 10 },
    { productId: "invalid", quantity: 1, price: "not-a-number" },
  ]), [
    { productId: "clipper", name: "Tondeuse", variantId: "white", variantLabel: "Blanche", quantity: 2, price: 19.99, lineTotal: 39.98 },
    { productId: "comb", name: "Peigne", variantId: null, variantLabel: null, quantity: 1, price: 0, lineTotal: 0 },
  ]);
  assert.deepEqual(serializeCustomerCartItems({}), []);

  const product = { id: "clipper", name: "Tondeuse", price: 29, variants: [{ id: "white", name: "Blanche", price: 30 }] };
  const tracked = buildTrackedCartSnapshot([
    { productId: "clipper", variantId: null, quantity: 2 },
    { productId: "clipper", variantId: "old-variant", quantity: 1 },
    { productId: "deleted-product", variantId: null, quantity: 1 },
    { productId: "clipper", variantId: "white", quantity: 3 },
  ], [product]);
  assert.equal(tracked.items.length, 4);
  assert.equal(tracked.itemCount, 7);
  assert.equal(tracked.items[0].variantId, null);
  assert.equal(tracked.items[1].variantId, "old-variant");
  assert.equal(tracked.items[2].productId, "deleted-product");
  assert.ok(tracked.items.slice(0, 3).every((line) => line.validationIssue));
  assert.equal(tracked.items[3].validationIssue, null);
  assert.equal(tracked.items[3].price, 30);
  assert.equal(tracked.validationIssues.length, 2);
  assert.equal(serializeCustomerCartItems(tracked.items).length, 4);
  assert.ok(serializeCustomerCartItems(tracked.items)[0].validationIssue);
  assert.deepEqual(buildTrackedCartSnapshot([], []), { items: [], itemCount: 0, total: 0, validationIssues: [] });

  const updatedAt = new Date("2026-11-01T10:00:00Z");
  const queries: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  let claims = 0;
  const tx = {
    abandonedCartSession: {
      updateMany: async (query: typeof queries[number]) => {
        queries.push(query);
        return { count: claims++ === 0 ? 1 : 0 };
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, "abandonedCartSession">;
  await claimCartForDraft(tx, { id: "session", updatedAt });
  assert.deepEqual(queries[0].where, { id: "session", convertedAt: null, itemCount: { gt: 0 }, updatedAt });
  assert.ok(queries[0].data.convertedAt instanceof Date);
  await assert.rejects(claimCartForDraft(tx, { id: "session", updatedAt }), /modifié ou déjà transformé/);
  console.log("✓ Paniers clients : filtrage, variantes, identité sans vidage et protection de conversion validés");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });

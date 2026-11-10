import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { cleanRelayDisplayText, normalizeRelayPointSnapshot } from "../utils/mondialRelayDisplay";
import { normalizeExchangeRelayPoint, normalizeExchangeShippingAddress } from "./orderExchangeService";

const client = Object.freeze({ firstName: "Élodie", lastName: "D''Alès", address: "Allée de l’École D''ALÈS",
  extension: "Bâtiment É", postalCode: "30500", city: "Uzès", country: "France", phone: "+33 6 00 00 00 00" });
assert.deepEqual(normalizeExchangeShippingAddress(client), client, "customer accents and repeated apostrophes untouched");
for (const input of [
  { id: "020965", name: "L''Épicerie", address: "98 ROUTE D''ALES", city: "D''Alès", postalCode: "30500", country: "FR" },
  { relayPointId: "020965", relayPointName: "L''Épicerie", relayPointAddress: "98 ROUTE D''ALES", city: "D''Alès", postalCode: "30500", country: "FR" },
]) {
  const before = JSON.stringify(input);
  const snapshot = normalizeExchangeRelayPoint(input);
  assert.deepEqual(snapshot, { id: "020965", name: "L'Épicerie", address: "98 ROUTE D'ALES", city: "D'Alès", postalCode: "30500", country: "FR" });
  assert.deepEqual(normalizeExchangeRelayPoint(snapshot), snapshot);
  assert.equal(JSON.stringify(input), before, "relay input not mutated");
}
assert.equal(normalizeExchangeRelayPoint({ name: "No ID" }), null);

// Inspect and evaluate the actual scalar Prisma write expressions, without
// running checkout, payment, authentication or DB operations. The eight
// assertions cover standard/draft redirect and standard/draft PayPal writes.
const filename = path.join(__dirname, "../routes/checkout.ts");
const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
const writes: ts.PropertyAssignment[] = [];
function visit(node: ts.Node): void {
  if (ts.isPropertyAssignment(node) && ["relayPointName", "relayPointAddress"].includes(node.name.getText(source))) writes.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(writes.length, 8, "all checkout relay name/address write boundaries");
const body = Object.freeze({ relayPointName: "L''Épicerie", relayPointAddress: "98 ROUTE D''ALES", relayPointId: "020965", shippingAddress: client, billingAddress: client });
for (const write of writes) {
  const expression = write.initializer.getText(source);
  assert.match(expression, /cleanRelayDisplayText\(/, "every write uses the shared helper");
  const context = { body, isNoShipping: false, isNoShippingPaypal: false, cleanRelayDisplayText };
  assert.equal(vm.runInNewContext(expression, context), write.name.getText(source) === "relayPointName" ? "L'Épicerie" : "98 ROUTE D'ALES");
  assert.equal(vm.runInNewContext(expression, { ...context, body: { ...body, relayPointName: undefined, relayPointAddress: undefined } }), null);
  if (expression.includes("isNoShipping")) {
    assert.equal(vm.runInNewContext(expression, { ...context, isNoShipping: true, isNoShippingPaypal: true }), null);
  }
}
assert.equal(body.shippingAddress, client);
assert.equal(body.billingAddress, client);
assert.equal(body.relayPointId, "020965");
assert.equal(client.address, "Allée de l’École D''ALÈS");

const exchangeFilename = path.join(__dirname, "../routes/order-exchanges.ts");
const exchangeSource = ts.createSourceFile(exchangeFilename, fs.readFileSync(exchangeFilename, "utf8"), ts.ScriptTarget.Latest, true);
const snapshotWrites: ts.PropertyAssignment[] = [];
function visitSnapshots(node: ts.Node): void {
  if (ts.isPropertyAssignment(node) && node.name.getText(exchangeSource) === "relayPointSnapshot"
      && node.initializer.getText(exchangeSource).includes("normalizeRelayPointSnapshot(")) snapshotWrites.push(node);
  ts.forEachChild(node, visitSnapshots);
}
visitSnapshots(exchangeSource);
assert.equal(snapshotWrites.length, 2, "shipment upsert create and update normalize the actual snapshot");
const dbNull = Object.freeze({ kind: "DbNull" });
const relayPointSnapshot = Object.freeze({ id: "020965", name: "L''Épicerie", address: "D''ALES", city: "Alès",
  fullAddress: "D''ALES, Alès", shippingAddressSnapshot: client, extra: 42 });
for (const write of snapshotWrites) {
  const expression = write.initializer.getText(exchangeSource);
  const normalized = vm.runInNewContext(expression, { params: { relayPointSnapshot }, normalizeRelayPointSnapshot, Prisma: { DbNull: dbNull } });
  assert.deepEqual(normalized, { ...relayPointSnapshot, name: "L'Épicerie", address: "D'ALES", fullAddress: "D'ALES, Alès" });
  assert.equal(normalized.id, "020965");
  assert.equal(normalized.shippingAddressSnapshot, client);
  assert.equal(vm.runInNewContext(expression, { params: { relayPointSnapshot: null }, normalizeRelayPointSnapshot, Prisma: { DbNull: dbNull } }), dbNull);
}
assert.equal(relayPointSnapshot.address, "D''ALES");
console.log("✓ Exchange snapshots + 8 checkout and 2 shipment snapshot write expressions passed; client accents and apostrophes preserved (no DB/payment/label calls)");

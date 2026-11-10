import assert from "node:assert/strict";
import { cleanRelayDisplayText, normalizeRelayPointSnapshot } from "./mondialRelayDisplay";
import { decodeXmlText } from "./mondialRelayXml";

for (const [input, expected] of [
  ["98 ROUTE D''ALES", "98 ROUTE D'ALES"],
  ["D''''ITALIE / D'''UZÈS", "D'ITALIE / D'UZÈS"],
  ["L'Atelier d'Alès", "L'Atelier d'Alès"],
  ["  Allée de l’École / D’’ALÈS  ", "  Allée de l’École / D’’ALÈS  "],
  ["020965", "020965"],
  ["", ""],
]) {
  assert.equal(cleanRelayDisplayText(input), expected);
  assert.equal(cleanRelayDisplayText(expected), expected, "idempotence");
}

assert.equal(decodeXmlText("&amp; &lt; &gt; &quot; &apos; &#39; &#x27; &#X27; &#233; &#xE9;"),
  "& < > \" ' ' ' &#X27; é é");
assert.equal(decodeXmlText("&amp;apos; &amp;#39; &unknown;"), "&apos; &#39; &unknown;", "decode once only");
assert.equal(decodeXmlText("&#0; &#xD800; &#1114112; &#x110000;"), "&#0; &#xD800; &#1114112; &#x110000;");
assert.equal(decodeXmlText("&#x1F600;"), String.fromCodePoint(0x1f600));

const client = Object.freeze({ firstName: "Élodie", lastName: "D''Alès", address: "Allée de l’École D''ALÈS", city: "Uzès" });
const input = Object.freeze({
  id: "020965",
  name: "L''Épicerie",
  address: "98 ROUTE D''ALES",
  city: "D''Alès",
  fullAddress: "98 ROUTE D''ALES, 30500, D''Alès",
  relayPointName: "L''Épicerie",
  relayPointAddress: "D'''ITALIE",
  postalCode: "30500",
  country: "FR",
  latitude: 44.25,
  missing: null,
  nonDisplay: "KEEP''THIS",
  shippingAddressSnapshot: client,
});
const normalized = normalizeRelayPointSnapshot(input);
assert.deepEqual(normalized, { ...input, name: "L'Épicerie", address: "98 ROUTE D'ALES", city: "D'Alès",
  fullAddress: "98 ROUTE D'ALES, 30500, D'Alès", relayPointName: "L'Épicerie", relayPointAddress: "D'ITALIE" });
assert.deepEqual(normalizeRelayPointSnapshot(normalized), normalized);
assert.equal(input.address, "98 ROUTE D''ALES", "do not mutate input");
assert.equal(normalized.shippingAddressSnapshot, client, "never traverse customer snapshots");
assert.equal(client.address, "Allée de l’École D''ALÈS");
assert.deepEqual(normalizeRelayPointSnapshot({ name: 42, address: null, city: ["D''ALES"] }), { name: 42, address: null, city: ["D''ALES"] });
for (const value of [null, undefined, 42, "D''ALES", ["D''ALES"], {}]) {
  assert.deepEqual(normalizeRelayPointSnapshot(value), value, "preserve non-object JSON and empty objects");
}
console.log("✓ Relay display, XML entities and snapshot normalization passed (customer data preserved)");

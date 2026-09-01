import assert from "assert";
import {
  normalizeShippingAddressContact,
  stripImportedLeadingApostrophe,
} from "./shippingAddressNormalization";

assert.strictEqual(stripImportedLeadingApostrophe("'01250"), "01250");
assert.strictEqual(stripImportedLeadingApostrophe("’0612345678"), "0612345678");
assert.strictEqual(stripImportedLeadingApostrophe("+33 6 12 34 56 78"), "+33 6 12 34 56 78");
assert.strictEqual(stripImportedLeadingApostrophe("  01250  "), "01250");

const normalized = normalizeShippingAddressContact({
  postalCode: "'01250",
  phone: "'0612345678",
  city: "Ceyzériat",
  address: "12 rue des Tests",
});
assert.deepStrictEqual(normalized, {
  postalCode: "01250",
  phone: "0612345678",
  city: "Ceyzériat",
  address: "12 rue des Tests",
});

console.log("✓ Normalisation des adresses de livraison validée");

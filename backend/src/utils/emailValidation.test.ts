import assert from "assert";
import { isValidEmailAddress, normalizeEmailAddress } from "./emailValidation";

assert.strictEqual(normalizeEmailAddress("  Client@Example.fr "), "client@example.fr");
assert.strictEqual(isValidEmailAddress("client@example.fr"), true);
assert.strictEqual(isValidEmailAddress("clientexample.fr"), false);
assert.strictEqual(isValidEmailAddress("client@localhost"), false);
assert.strictEqual(isValidEmailAddress("client @example.fr"), false);

console.log("✓ Validation des e-mails client validée");

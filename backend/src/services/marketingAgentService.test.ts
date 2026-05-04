import assert from "node:assert/strict";
import { calculateDiscountAmount, slugifyMarketing } from "./marketingAgentService";
import { getBrevoStatus } from "./brevoMarketingService";

const previousBrevoKey = process.env.BREVO_API_KEY;
delete process.env.BREVO_API_KEY;

assert.equal(slugifyMarketing("Promo Été Barbier 2026 !"), "promo-ete-barbier-2026");
assert.equal(slugifyMarketing("---"), "campagne-marketing");

assert.equal(calculateDiscountAmount({ type: "percentage", value: 20, subtotal: 150 }), 30);
assert.equal(calculateDiscountAmount({ type: "percentage", value: 150, subtotal: 80 }), 80);
assert.equal(calculateDiscountAmount({ type: "fixed", value: 25, subtotal: 20 }), 20);
assert.equal(calculateDiscountAmount({ type: "free_shipping", value: 0, subtotal: 120, shipping: 7.9 }), 7.9);
assert.equal(calculateDiscountAmount({ type: "fixed", value: -10, subtotal: 120 }), 0);

const status = getBrevoStatus();
assert.equal(status.configured, false);
assert.match(status.message, /BREVO_API_KEY/);
assert.match(status.message, /Render/);

if (previousBrevoKey) process.env.BREVO_API_KEY = previousBrevoKey;

console.log("marketingAgent regression tests passed");

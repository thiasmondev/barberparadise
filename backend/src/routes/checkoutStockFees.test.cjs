// Run: node src/routes/checkoutStockFees.test.cjs (from backend).
// Real router source transpiled in a VM. Request/response HTTP, DB, JWT and providers are mocked.
// No network primitive, application import, real environment or credentials are exposed to the VM.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const plain = (value) => JSON.parse(JSON.stringify(value));
const source = (rel) => fs.readFileSync(path.join(root, rel + '.ts'), 'utf8');
const env = { JWT_SECRET: 'FICTIONAL_NOT_A_SECRET', PRO_PRICE_THRESHOLD_HT: '200', B2B_CARD_SURCHARGE_PERCENT: '2.5', B2B_PAYPAL_SURCHARGE_PERCENT: '3.4', MOLLIE_API_KEY: 'FICTIONAL_NOT_A_KEY', PAYPAL_CLIENT_ID: 'FICTIONAL_NOT_A_KEY', PAYPAL_CLIENT_SECRET: 'FICTIONAL_NOT_A_KEY' };
const silent = { log() {}, warn() {}, error() {} };
function compile(text, globals = {}, resolver = () => { throw Error('Forbidden import'); }) {
  const module = { exports: {} };
  const context = { module, exports: module.exports, console: silent, process: { env: { ...env } }, require: resolver, Date, Buffer, URLSearchParams, ...globals };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, context);
  return context;
}
const modules = {};
function pure(rel) {
  if (!modules[rel]) modules[rel] = compile(source(rel), {}, (name) => {
    if (rel === 'services/paymentRouter' && name === './b2bPaymentSurchargeService') return pure('services/b2bPaymentSurchargeService');
    throw Error('Forbidden pure import: ' + name);
  }).exports;
  return modules[rel];
}
let state;
function product(id = 'sku', patch = {}) {
  return { id, name: 'Fixture ' + id, status: 'active', price: 84, priceProEur: 50, inStock: true, stockCount: 4, images: '[]', variants: [], slug: id, category: 'fixture', ...patch };
}
function draft(patch = {}) {
  return { id: 'draft', status: 'draft', orderNumber: 'FIXTURE-DRAFT', email: 'fixture@example.invalid', customerEmail: 'fixture@example.invalid', draftShareExpiresAt: new Date('2099-01-01'), draftShareConvertedAt: null, isB2B: true, pricingTier: 'pro', noShipping: false, subtotal: 110.01, shipping: 12.37, totalHT: 100.01, vatRate: 20, vatAmount: 20, totalTTC: 132.38, total: 132.38, discountAmount: 10, discountTotal: 10, orderDiscountType: 'fixed', orderDiscountValue: 10, items: [{ id: 'line', productId: 'sku', variantId: null, variantLabel: null, name: 'Frozen', price: 60.01, quantity: 2, discountAmount: 10.01, lineDiscountType: 'fixed', lineDiscountValue: 10.01, isCustomSale: false }], ...patch };
}
function reset(patch = {}) { state = { products: [product(), product('other', { price: 60, priceProEur: 50, stockCount: 10 })], draft: null, writes: [], providerCalls: [], created: null, promotionCalls: 0, automaticPromotionCalls: 0, ...patch }; }
const routes = {};
const fakePrisma = {
  proAccount: { findUnique: async (query) => query.where.customerId === 'pro' ? { status: 'approved', vatNumber: null } : { status: 'pending' } },
  product: { findUnique: async (query) => state.products.find((p) => p.id === query.where.id) || null, findMany: async (query) => state.products.filter((p) => query.where.id.in.includes(p.id)) },
  order: {
    findFirst: async (query) => {
      if (query.where.status === 'pending') return null;
      if (!state.draft || state.draft.draftShareConvertedAt || state.invalidToken) return null;
      if (query.include?.items?.include?.product) return { ...state.draft, items: state.draft.items.map((item) => ({ ...item, product: state.products.find((p) => p.id === item.productId) || null })) };
      return state.draft;
    },
    create: async (query) => { state.writes.push(plain(query)); state.created = { ...plain(query.data), id: 'pending', orderNumber: 'FIXTURE-PENDING' }; return state.created; },
    update: async (query) => { state.writes.push(plain(query)); return state.created || state.draft; },
    updateMany: async (query) => { state.writes.push(plain(query)); return { count: 1 }; },
    delete: async (query) => { state.writes.push(plain(query)); return {}; },
  },
  abandonedCartSession: { updateMany: async (query) => { state.writes.push(plain(query)); return { count: 1 }; } },
  promoCode: { findUnique: async () => null },
};
const imports = {
  express: { Router: () => ({ get(url, handler) { routes['GET ' + url] = handler; }, post(url, handler) { routes['POST ' + url] = handler; } }) },
  jsonwebtoken: { verify: (token) => { if (token !== 'fixture-pro-token') throw Error('Invalid fictional token'); return { id: 'pro' }; } },
  crypto,
  '../utils/prisma': { prisma: fakePrisma },
  '../utils/frontendUrl': { getFrontendUrl: () => 'https://frontend.example.invalid' },
  '../services/paymentRouter': pure('services/paymentRouter'),
  '../services/shippingCalculator': { calculateShippingOptions: async () => [{ id: 'port', carrier: 'fixture', label: 'Fixture', price: 12.37 }], getFreeShippingThresholdForCountry: async () => 999, calculateFreeShippingRemaining: async () => 0 },
  '../services/vatCalculator': pure('services/vatCalculator'),
  '../services/marketingAgentService': { calculateDiscountAmount: () => 0 },
  '../services/promotionService': { validateCode: async (params) => { state.promotionCalls++; return { valid: true, discount: 1.03, discountType: params.code === 'SHIP' ? 'free_shipping' : 'fixed' }; } },
  '../services/abandonedCartReminderService': {},
  '../services/productPricingService': { getActiveAutomaticProductPromotions: async () => { state.automaticPromotionCalls++; return { promotions: [], categoryTargets: {} }; }, getBestAutomaticPromotionForProduct: () => ({ price: 0.01 }) },
  '../services/b2bPaymentSurchargeService': pure('services/b2bPaymentSurchargeService'),
  '../utils/shippingAddressNormalization': pure('utils/shippingAddressNormalization'),
  '../utils/emailValidation': pure('utils/emailValidation'),
  '../utils/mondialRelayDisplay': { cleanRelayDisplayText: (value) => value },
  '../services/b2bPricingService': pure('services/b2bPricingService'),
  '../services/customerCartService': {},
  '../services/checkoutStockService': pure('services/checkoutStockService'),
};
const fakeFetch = async (url, options) => {
  state.providerCalls.push({ url, body: options.body });
  if (url.includes('/oauth2/token')) return { ok: true, text: async () => JSON.stringify({ access_token: 'FICTIONAL_NOT_A_TOKEN' }) };
  const body = JSON.parse(options.body);
  const amount = body.amount?.value || body.purchase_units?.[0]?.amount?.value;
  state.providerAmount = amount;
  const data = url.includes('mollie') ? { id: 'payment', _links: { checkout: { href: 'https://payment.example.invalid' } } } : { id: 'paypal-order', links: [{ rel: 'approve', href: 'https://payment.example.invalid' }] };
  return { ok: true, text: async () => JSON.stringify(data) };
};
const backend = compile(source('routes/checkout') + '\nexports.testFee = calculateCheckoutPaymentFee;', { fetch: fakeFetch }, (name) => {
  if (!(name in imports)) throw Error('Forbidden checkout import: ' + name);
  return imports[name];
});
async function call(key, body = {}, query = {}, params = {}, pro = true) {
  const result = { status: 200, data: null, headers: {} };
  const req = { body: plain(body), query, params, headers: pro ? { authorization: 'Bearer fixture-pro-token' } : {}, protocol: 'https', get: () => 'backend.example.invalid' };
  const res = { status(n) { result.status = n; return this; }, json(value) { result.data = plain(value); return this; }, setHeader(key, value) { result.headers[key] = value; } };
  await routes[key](req, res);
  return result;
}
function payload(patch = {}) {
  return { cartItems: [{ productId: 'sku', quantity: 3 }, { productId: 'other', quantity: 1 }], isB2B: true, customerId: 'pro', customerEmail: 'fixture@example.invalid', paymentMethod: 'card', shippingOptionId: 'port', shippingAddress: { firstName: 'Fixture', lastName: 'Test', address: 'Fixture', city: 'Fixture', postalCode: '00000', country: 'FR' }, ...patch };
}
const results = [];
(async () => {
  // Preview prices every requested line, even across stock boundaries and tariff threshold.
  for (const qty of [3, 5]) {
    reset();
    const items = [{ productId: 'sku', quantity: qty }, { productId: 'other', quantity: 1 }];
    const quote = await call('GET /pricing-quote', {}, { cartItems: JSON.stringify(items), isB2B: 'true', country: 'FR' });
    assert.equal(quote.status, 200);
    assert.equal(quote.data.pricingTier, 'pro');
    assert.deepEqual(quote.data.items.map((line) => line.priceSource), ['pro', 'pro']);
    assert.equal(quote.data.items[0].quantity, qty);
    assert.equal(quote.data.items[0].availableStock, 4);
    assert.equal(quote.data.stockIssues.length, qty === 5 ? 1 : 0);
    assert.equal(state.writes.length, 0);
    if (qty === 5) assert.deepEqual(quote.data.stockIssues[0], { productId: 'sku', variantId: null, availableStock: 4, requestedQuantity: 5, code: 'INSUFFICIENT_STOCK', message: 'Stock insuffisant pour Fixture sku' });
    results.push({ case: 'pro preview qty ' + qty + ' stock 4', status: quote.status, tier: quote.data.pricingTier });
  }
  reset();
  const blocked = await call('POST /initiate', payload({ cartItems: [{ productId: 'sku', quantity: 5 }, { productId: 'other', quantity: 1 }] }));
  assert.equal(blocked.status, 409); assert.equal(blocked.data.code, 'INSUFFICIENT_STOCK');
  assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
  reset();
  const duplicate = await call('POST /initiate', payload({ cartItems: [{ productId: 'sku', quantity: 3 }, { productId: 'sku', quantity: 2 }] }));
  assert.equal(duplicate.status, 409); assert.equal(duplicate.data.stockIssues[0].requestedQuantity, 5);
  assert.equal(state.providerCalls.length, 0);
  results.push({ case: 'catalog payment blocked before writes/provider including duplicate SKU', status: blocked.status });

  // Variant availability is independent of parent; null is unknown, false is zero.
  reset({ products: [product('sku', { inStock: false, stockCount: 0, priceProEur: 999, variants: [{ id: 'blue', name: 'Blue', price: 60, priceProEur: null, inStock: true, stock: 4 }] })] });
  let quote = await call('GET /pricing-quote', {}, { cartItems: JSON.stringify([{ productId: 'sku', variantId: 'blue', quantity: 5 }]), isB2B: 'true' });
  assert.equal(quote.status, 200); assert.equal(quote.data.items[0].availableStock, 4); assert.equal(quote.data.items[0].priceSource, 'retail');
  assert.equal((await call('POST /initiate', payload({ cartItems: [{ productId: 'sku', variantId: 'blue', quantity: 5 }] }))).status, 409);
  assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
  assert.equal((await call('POST /initiate', payload({ cartItems: [{ productId: 'sku', variantId: 'blue', quantity: 4 }] }))).status, 201);
  reset({ products: [product('sku', { stockCount: null })] });
  quote = await call('GET /pricing-quote', {}, { cartItems: JSON.stringify([{ productId: 'sku', quantity: 99 }]), isB2B: 'true' });
  assert.equal(quote.data.items[0].availableStock, null); assert.equal(quote.data.stockIssues.length, 0);
  assert.equal((await call('POST /initiate', payload({ cartItems: [{ productId: 'sku', quantity: 99 }] }))).status, 201);
  reset({ products: [product('sku', { inStock: false, stockCount: 99 })] });
  quote = await call('GET /pricing-quote', {}, { cartItems: JSON.stringify([{ productId: 'sku', quantity: 1 }]), isB2B: 'true' });
  assert.equal(quote.data.items[0].availableStock, 0); assert.equal(quote.data.stockIssues.length, 1);
  assert.equal((await call('POST /initiate', payload({ cartItems: [{ productId: 'sku', quantity: 1 }] }))).status, 409);
  assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);

  // GET draft keeps frozen prices/discounts while showing live stock; no live promo reprice.
  reset({ draft: draft(), products: [product('sku', { stockCount: 1, price: 999, priceProEur: 999 })] });
  const get = await call('GET /draft/:token', {}, {}, { token: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF' }, false);
  assert.equal(get.status, 200); assert.equal(get.data.draft.items[0].price, 60.01); assert.equal(get.data.draft.items[0].discountAmount, 10.01);
  assert.equal(get.data.draft.totalTTC, 132.38); assert.equal(get.data.draft.items[0].quantity, 2);
  assert.equal(get.data.draft.items[0].availableStock, 1); assert.equal(get.data.draft.stockIssues.length, 1);
  assert.equal(state.automaticPromotionCalls, 0);
  assert.equal(state.writes.length, 1); assert.deepEqual(Object.keys(state.writes[0].data), ['draftShareLastAccessedAt']);
  state.writes = [];
  const draftBody = payload({ draftToken: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF', cartItems: [{ productId: 'sku', quantity: 2 }] });
  const denied = await call('POST /initiate', draftBody);
  assert.equal(denied.status, 409); assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
  // Preview guest token reads the offer before any pro guard; no email mandatory, no writes.
  const guestQuote = await call('POST /payment-quote', { ...draftBody, customerId: undefined, customerEmail: undefined }, {}, {}, false);
  assert.equal(guestQuote.status, 200); assert.equal(guestQuote.data.source, 'draft'); assert.equal(guestQuote.data.baseTotalTTC, 132.38);
  assert.equal(guestQuote.data.stockIssues.length, 1); assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
  assert.equal((await call('POST /payment-quote', { ...draftBody, customerId: undefined, cartItems: [{ productId: 'sku', quantity: 3 }] }, {}, {}, false)).status, 403);
  results.push({ case: 'draft frozen with live stock + guest fee preview, payment blocked', status: denied.status });
  const variantProduct = product('sku', { inStock: true, stockCount: 999, variants: [{ id: 'blue', name: 'Blue', price: 999, priceProEur: 999, inStock: false, stock: 999 }] });
  reset({ products: [variantProduct], draft: draft({ items: [{ ...draft().items[0], variantId: 'blue', variantLabel: 'Blue' }] }) });
  const variantDraft = await call('GET /draft/:token', {}, {}, { token: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF' }, false);
  assert.equal(variantDraft.data.draft.items[0].availableStock, 0);
  assert.equal(variantDraft.data.draft.items[0].price, 60.01); assert.equal(variantDraft.data.draft.items[0].variants[0].price, 60.01);
  assert.equal(variantDraft.data.draft.items[0].variants[0].stock, 0); assert.equal(variantDraft.data.draft.items[0].discountAmount, 10.01);

  // Same monetary source for quote and actual Mollie/PayPal requests, all cents persisted.
  for (const isDraft of [false, true]) for (const method of ['paybybank', 'card', 'paypal']) for (const promoCode of [undefined, 'FIXED', 'SHIP']) {
    reset({ draft: isDraft ? draft() : null });
    const body = payload({ paymentMethod: method, promoCode, ...(isDraft ? { draftToken: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF', cartItems: [{ productId: 'sku', quantity: 2 }] } : {}) });
    const feeQuote = await call('POST /payment-quote', { ...body, amount: 0.01, totalTTC: 0.01 });
    assert.equal(feeQuote.status, 200); assert.equal(feeQuote.data.source, isDraft ? 'draft' : 'catalog');
    assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
    const pay = await call('POST /initiate', { ...body, amount: 0.01, totalTTC: 0.01 });
    assert.equal(pay.status, 201);
    assert.equal(state.providerAmount, feeQuote.data.totalTTC.toFixed(2));
    assert.equal(state.created.totalTTC, feeQuote.data.totalTTC);
    assert.equal(state.created.paymentFeeTTC, feeQuote.data.paymentFeeTTC);
    assert.equal(state.created.totalHT, feeQuote.data.totalHT); assert.equal(state.created.vatAmount, feeQuote.data.vatAmount);
    assert.equal('paidAmount' in state.created, false);
    if (method === 'paybybank') assert.equal(feeQuote.data.paymentFeeTTC, 0);
    if (isDraft) { assert.equal(state.created.items.create[0].price, 60.01); assert.equal(state.created.discountTotal, 10); assert.equal(state.created.shipping, 12.37); }
    results.push({ case: (isDraft ? 'draft' : 'catalog') + ' quote/payment cents', method, promoCode: promoCode || null, total: state.providerAmount });
  }
  // B2C draft must not gain B2B fees from an approved current customer.
  reset({ draft: draft({ isB2B: false, pricingTier: 'retail' }) });
  quote = await call('POST /payment-quote', payload({ draftToken: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF', cartItems: [{ productId: 'sku', quantity: 2 }] }));
  assert.equal(quote.data.paymentFeeTTC, 0); assert.equal(quote.data.totalTTC, 132.38);
  // No method selected => no fee quote. No accidental zero-cost fallback.
  reset(); assert.equal((await call('POST /payment-quote', payload({ paymentMethod: undefined, customerEmail: undefined }))).status, 400);
  reset();
  assert.equal((await call('POST /payment-quote', payload({ customerEmail: undefined }))).status, 200, 'Catalogue fee preview does not require email');
  for (const country of ['BE', 'CH']) {
    reset();
    const foreign = payload({ vatNumber: country === 'BE' ? 'BE-FIXTURE' : undefined, shippingAddress: { ...payload().shippingAddress, country } });
    const foreignQuote = await call('POST /payment-quote', foreign);
    assert.equal(foreignQuote.status, 200);
    assert.equal((await call('POST /initiate', { ...foreign, expectedTotalTTC: foreignQuote.data.totalTTC })).status, 201);
    assert.equal(state.providerAmount, foreignQuote.data.totalTTC.toFixed(2));
    assert.equal(state.created.paymentFeeVatRate, 20, 'Distinct payment fee VAT policy unchanged');
    results.push({ case: 'tax-exempt catalogue quote/payment cents', country, total: state.providerAmount });
  }
  // Explicit rounding counterexample proves no client percentage path is used.
  let counterexample;
  for (let cents = 1; cents < 50000; cents++) {
    const base = cents / 100;
    const fee = backend.exports.testFee({ isB2B: true, method: 'card', totalTTC: base });
    const clientFee = Math.round((base * 0.025 + Number.EPSILON) * 100) / 100;
    if (fee.feeTTC !== clientFee) { counterexample = { base, fee: fee.feeTTC, clientFee }; break; }
  }
  assert.ok(counterexample);
  reset({ draft: draft({ totalTTC: counterexample.base, total: counterexample.base }) });
  const centsBody = payload({ draftToken: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF', cartItems: [{ productId: 'sku', quantity: 2 }] });
  quote = await call('POST /payment-quote', centsBody);
  await call('POST /initiate', centsBody);
  assert.equal(quote.data.paymentFeeTTC, counterexample.fee); assert.equal(state.providerAmount, quote.data.totalTTC.toFixed(2));
  results.push({ case: 'rounding counterexample server cent identity', ...counterexample });
  // Zero persisted draft total does not fall through to legacy non-zero total.
  reset({ draft: draft({ totalTTC: 0, total: 999 }) });
  quote = await call('POST /payment-quote', centsBody); assert.equal(quote.data.baseTotalTTC, 0);
  // Optimistic amount fields only compare: a stale quote must never create/convert/fund.
  for (const isDraft of [false, true]) {
    reset({ draft: isDraft ? draft() : null });
    const body = payload(isDraft ? { draftToken: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF', cartItems: [{ productId: 'sku', quantity: 2 }] } : {});
    const before = await call('POST /payment-quote', body);
    const stale = await call('POST /initiate', { ...body, expectedTotalTTC: Number((before.data.totalTTC - 0.01).toFixed(2)) });
    assert.equal(stale.status, 409); assert.equal(stale.data.code, 'PAYMENT_QUOTE_CHANGED');
    assert.equal(stale.data.error, 'Le montant a été mis à jour. Vérifiez le total puis confirmez à nouveau.');
    assert.doesNotMatch(stale.data.error, /PAYMENT_QUOTE_CHANGED|Mollie|PayPal/);
    assert.equal(stale.data.totalTTC, before.data.totalTTC); assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
    const staleBase = await call('POST /initiate', { ...body, expectedTotalTTC: before.data.totalTTC, expectedBaseTotalTTC: 0.01 });
    assert.equal(staleBase.status, 409); assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
    const current = await call('POST /initiate', { ...body, expectedTotalTTC: before.data.totalTTC, expectedBaseTotalTTC: before.data.baseTotalTTC });
    assert.equal(current.status, 201); assert.equal(state.providerAmount, before.data.totalTTC.toFixed(2));
    results.push({ case: (isDraft ? 'draft' : 'catalog') + ' expected quote cents mismatch blocks before writes/provider', status: stale.status });
  }
  reset();
  const driftingBody = payload();
  const beforeDrift = await call('POST /payment-quote', driftingBody);
  state.products[0].priceProEur = 50.01;
  const drifted = await call('POST /initiate', { ...driftingBody, expectedTotalTTC: beforeDrift.data.totalTTC });
  assert.equal(drifted.status, 409); assert.equal(drifted.data.code, 'PAYMENT_QUOTE_CHANGED');
  assert.equal(state.writes.length, 0); assert.equal(state.providerCalls.length, 0);
  results.push({ case: 'live catalogue price drift after quote', status: drifted.status });
  // Custom draft rows are never checked against a catalogue or stock count.
  reset({ draft: draft({ items: [{ id: 'custom', productId: null, variantId: null, quantity: 3, name: 'Custom', price: 10, discountAmount: 0, isCustomSale: true }] }), products: [] });
  quote = await call('POST /payment-quote', { draftToken: 'SYNTHETIC_DRAFT_TOKEN_0123456789_ABCDEF', paymentMethod: 'card' }, {}, {}, false);
  assert.equal(quote.status, 200); assert.equal(quote.data.items[0].availableStock, null); assert.equal(quote.data.stockIssues.length, 0);
  // V2 remains disabled; no configuration or capture behaviour changed.
  reset(); assert.equal((await call('POST /paypal/v2/create-order', payload({ paymentMethod: 'paypal' }))).status, 404);
  assert.equal(state.providerCalls.length, 0); assert.equal(state.writes.length, 0);
  console.log(JSON.stringify({ mode: 'real router transpiled, simulated HTTP/ORM/providers', realNetworkCalls: 0, paypalV2Enabled: false, results, assertions: 'passed' }, null, 2));
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });

// REACT_TEST_NODE_MODULES=/tmp/customer-carts-tests/node_modules node frontend/src/lib/cart-stock.test.cjs
// Isolated React harness: all storage/fetch operations are mocked. No dependencies are added to the repository.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const ts = require(path.resolve(root, '../node_modules/typescript'));
const reactRequire = createRequire(path.resolve(process.env.REACT_TEST_NODE_MODULES || '/tmp/customer-carts-tests/node_modules', '../package.json'));
const React = reactRequire('react');
const { create, act } = reactRequire('react-test-renderer');
const sleep = (ms = 1) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; }
function load(relative, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const sandbox = { exports: {}, require(name) { return name in imports ? imports[name] : require(name); },
    process: { env: { NEXT_PUBLIC_API_URL: 'https://local-test.invalid' } }, console, setTimeout, clearTimeout,
    AbortController, Headers, URLSearchParams, Date, Promise, JSON, Set, Map, Number, Error, crypto: require('node:crypto').webcrypto, ...globals };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, sandbox);
  return sandbox.exports;
}
const stock = load('lib/cart-stock.ts');
const product = { id: 'p', name: 'Produit test', brand: 'Test', price: 180, pricePublic: 180, variants: [], inStock: true, stockCount: 4 };
const line = (quantity, override = {}) => ({ product, quantity, variantId: null, ...override });
const globalsStorage = (storage) => ({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) });
function quote(quantity, availableStock = 4, tier = 'pro', isB2B = true) {
  return { isB2B, pricingTier: tier, thresholdHT: 200, qualifyingSubtotalHT: quantity * 50,
    remainingHT: Math.max(0, 200 - quantity * 50), progressPercent: Math.min(100, quantity * 25),
    items: [{ productId: 'p', variantId: null, quantity, retailUnitTTC: 180, retailUnitHT: 150,
      proUnitHT: 50, appliedUnitHT: tier === 'pro' ? 50 : 150, appliedUnitTTC: tier === 'pro' ? 60 : 180,
      priceSource: tier === 'pro' ? 'pro' : 'retail', availableStock }],
    stockIssues: availableStock !== null && quantity > availableStock
      ? [{ productId: 'p', variantId: null, availableStock, requestedQuantity: quantity, code: 'INSUFFICIENT_STOCK', message: 'Stock insuffisant' }] : [],
    subtotalHT: quantity * (tier === 'pro' ? 50 : 150), subtotalTTC: quantity * (tier === 'pro' ? 60 : 180),
    vatRate: 20, vatAmount: quantity * (tier === 'pro' ? 10 : 30), discountTotal: 0, totalTTC: quantity * (tier === 'pro' ? 60 : 180) };
}
function pureTests() {
  check(stock.getAvailableStock(line(1)) === 4, 'product stock known');
  check(stock.getAvailableStock(line(1, { variant: { id: 'v', stock: 2, inStock: true } })) === 2, 'variant stock has precedence');
  check(stock.getAvailableStock(line(1, { variant: { id: 'v', stock: 4, inStock: false } })) === 0, 'variant explicit unavailable');
  check(stock.getAvailableStock(line(1, { variant: { id: 'v', stock: null, inStock: true } })) === null, 'unknown variant never inherits parent count');
  check(stock.getAvailableStock(line(1, { product: { ...product, stockCount: null } })) === null, 'null stock is unknown, not zero');
  check(stock.getAvailableStock(line(1, { availableStock: null })) === null, 'live unknown never falls back to obsolete local stock');
  check(stock.getAvailableStock(line(1, { product: { ...product, stockCount: null, inStock: false } })) === 0, 'explicit product outage');
  const result = stock.constrainCartStock([line(5)]);
  check(result.items[0].quantity === 4 && result.quantitiesChanged, '5 requested / 4 stock clamps to 4');
  check(result.adjustments[0].message === 'Plus que 4 en stock · quantité ramenée de 5 à 4', 'reduction notice includes before and after');
  const batch = stock.constrainCartStock([line(5), line(8, { product: { ...product, id: 'p2', stockCount: 8 } })],
    [{ productId: 'p', availableStock: 3 }, { productId: 'p2', availableStock: 2 }]);
  check(batch.items[0].quantity === 3 && batch.items[1].quantity === 2 && batch.adjustments.length === 2, 'multi-line batch reconciles all lines');
  const outage = stock.constrainCartStock([line(5)], [{ productId: 'p', availableStock: 0 }]);
  check(outage.items.length === 1 && outage.items[0].quantity === 5 && outage.adjustments[0].blocked, 'stock0 preserves requested positive quantity and line');
  const zero = stock.constrainCartStock([line(0)], [{ productId: 'p', availableStock: 0 }]);
  check(zero.items[0].quantity === 1 && zero.adjustments[0].blocked, 'stock0 never produces invalid session quantity0');
  const unknown = stock.constrainCartStock([line(5)], [{ productId: 'p', availableStock: null }]);
  check(unknown.items[0].quantity === 5 && !stock.isCartStockBlocked(unknown.items[0]) && unknown.adjustments.length === 0, 'authoritative nullable stock preserves quantity without permanent block');
  check(stock.isCartStockBlocked(line(1, { product: { ...product, stockCount: null } })), 'unverified local unknown still blocks until quote');
  check(!stock.isCartStockBlocked(line(5, { isCustomSale: true, product: { ...product, stockCount: 0, inStock: false } })), 'custom sale is not stock-blocked');
  check(stock.constrainCartStock([line(5, { isCustomSale: true })]).items[0].quantity === 5, 'custom sale never inherits placeholder product stock');
  check(stock.getCartQuantityLimit(unknown.items[0]) === 999, 'unknown input fallback 999');
  const draft = stock.constrainCartStock([line(5)], [{ productId: 'p', availableStock: 4 }], { preserveDraftQuantities: true });
  check(draft.items[0].quantity === 5 && !draft.quantitiesChanged && draft.adjustments[0].blocked, 'signed draft mode preserves quantities and flags invalid stock');
}
async function pricingTests() {
  let implementation, aborted = false;
  const timers = new Map();
  const pricing = load('lib/checkout-pricing.ts', { '@/lib/api': { API_URL: 'https://local-test.invalid' }, '@/lib/customer-api': { CUSTOMER_TOKEN_KEY: 'token' }, '@/lib/cart-stock': stock },
    { fetch: (...args) => implementation(...args), window: { localStorage: globalsStorage(new Map()) },
      setTimeout(fn, delay) { check(delay === 15000, 'pricing timeout bounded to15s'); const id = setTimeout(fn, 5); timers.set(id, true); return id; },
      clearTimeout(id) { timers.delete(id); clearTimeout(id); } });
  const args = { cartItems: [{ productId: 'p', quantity: 5 }], isB2B: true };
  implementation = async () => response(quote(5));
  const valid = await pricing.getCheckoutPricingQuote(args);
  check(valid.items[0].quantity === 5 && valid.items[0].availableStock === 4, 'stock issue does not abort tariff quote');
  check(pricing.getPricingQuoteStockConstraints(valid)[0].code === 'INSUFFICIENT_STOCK', 'stockIssues override per-line stock');
  implementation = async () => response({ error: 'Service indisponible' }, 500);
  await assert.rejects(pricing.getCheckoutPricingQuote(args), /Service indisponible/); checks++;
  implementation = async () => response({ ...quote(5), totalTTC: null });
  await assert.rejects(pricing.getCheckoutPricingQuote(args), /incomplet/); checks++;
  implementation = async () => response(quote(4));
  await assert.rejects(pricing.getCheckoutPricingQuote(args), /correspond/); checks++;
  implementation = async (_, init) => { init.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); };
  await assert.rejects(pricing.getCheckoutPricingQuote(args), /expiré/); checks++;
  check(aborted && timers.size === 0, 'hung fetch aborted and timer cleared');
  implementation = async () => ({ ok: true, json: () => new Promise(() => {}) });
  await assert.rejects(pricing.getCheckoutPricingQuote(args), /expiré/); checks++;
  const abort = new AbortController(); aborted = false;
  implementation = async (_, init) => { init.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); };
  const cancelled = pricing.getCheckoutPricingQuote({ ...args, signal: abort.signal }); abort.abort();
  await assert.rejects(cancelled, { name: 'AbortError' }); checks++;
  check(aborted && timers.size === 0, 'external abort releases hung request');
}
const reactImports = { react: React, 'react/jsx-runtime': reactRequire('react/jsx-runtime'), '@/lib/customer-api': { CUSTOMER_TOKEN_KEY: 'token' }, '@/lib/cart-stock': stock };
async function contextTests() {
  let cart, renderer;
  const storage = new Map();
  const requests = [];
  const browser = new EventTarget(), doc = new EventTarget(); doc.visibilityState = 'visible';
  const context = load('contexts/CartContext.tsx', { ...reactImports, '@/lib/cart-session-sync': {
    createCartSessionSyncQueue() { return { cancelActive() {}, async enqueue(build) { const request = build(); if (!request) return { status: 'skipped' };
      requests.push(request); return { status: 'success', request, response: { sessionId: request.payload.sessionId, hasSnapshot: !!request.payload.cartItems,
        itemCount: request.payload.cartItems?.reduce((n, item) => n + item.quantity, 0), syncedAt: '2026-11-16T18:00:00Z', validationIssues: [] } }; } }; }
  } }, { localStorage: globalsStorage(storage), window: browser, document: doc, navigator: { onLine: true } });
  function Probe() { cart = context.useCart(); return null; }
  storage.set('barberparadise-cart', JSON.stringify([line(5)]));
  await act(async () => { renderer = create(React.createElement(context.CartProvider, null, React.createElement(Probe))); await sleep(); });
  check(cart.items[0].quantity === 4 && cart.stockAdjustments[0].requestedQuantity === 5, 'real React hydrated stock5->4 with notice');
  check(requests.every((request) => !request.payload.cartItems || request.payload.cartItems[0].quantity === 4), 'no invalid hydration snapshot sent');
  await act(async () => { cart.updateQuantity('p', 7); });
  check(cart.items[0].quantity === 4 && cart.stockAdjustments[0].requestedQuantity === 7, 'typed quantity clamped by context');
  await act(async () => { cart.updateQuantity('p', 2); cart.addItem(product, 3); });
  check(cart.items[0].quantity === 4 && cart.stockAdjustments[0].requestedQuantity === 5, 'same-tick add/update uses latest ref');
  await act(async () => { cart.replaceItems([line(5)]); });
  check(cart.items[0].quantity === 5 && cart.stockAdjustments[0].blocked, 'legacy replace preserves draft by default');
  let result;
  await act(async () => { result = cart.reconcileStock([{ productId: 'p', availableStock: 4 }], { preserveDraftQuantities: true }); });
  check(cart.items[0].quantity === 5 && !result.quantitiesChanged && cart.stockAdjustments[0].blocked, 'draft stock reconciliation preserves snapshot');
  await act(async () => { result = cart.reconcileStock([{ productId: 'p', availableStock: 4 }]); });
  check(cart.items[0].quantity === 4 && result.quantitiesChanged, 'ordinary reconcile atomically clamps and returns synchronous result');
  await act(async () => { cart.reconcileStock([{ productId: 'p', availableStock: 4 }]); });
  check(cart.stockAdjustments.some((notice) => notice.message.includes('de 5 à 4')), 'correction notice survives corrected quote');
  await act(async () => { cart.reconcileStock([{ productId: 'p', availableStock: 0 }]); });
  check(cart.items.length === 1 && cart.items[0].quantity === 4 && cart.stockAdjustments[0].blocked, 'outage remains visible with positive quantity');
  await act(async () => { cart.updateQuantity('p', 0); });
  check(cart.items.length === 1 && cart.items[0].quantity === 1, 'quantity0 mutation no longer silently deletes line');
  await act(async () => { cart.reconcileStock([{ productId: 'p', availableStock: null }]); });
  check(stock.getAvailableStock(cart.items[0]) === null && !stock.isCartStockBlocked(cart.items[0]) && cart.stockAdjustments.every((notice) => !notice.blocked), 'authoritative nullable stock clears stale blockers');
  await act(async () => { cart.replaceItems([line(5)], { preserveDraftQuantities: false }); });
  check(cart.items[0].quantity === 4, 'explicit ordinary replacement clamps');
  await act(async () => { cart.removeItem('p'); });
  check(cart.items.length === 0 && cart.stockAdjustments.length === 0, 'only explicit remove deletes line and notice');
  await act(async () => { renderer.unmount(); });
}
async function pageTests() {
  let implementation, cart, renderer, isPro = true;
  const calls = [];
  const storage = new Map(), session = new Map();
  const pricingBase = load('lib/checkout-pricing.ts', { '@/lib/api': { API_URL: 'mock' }, '@/lib/customer-api': { CUSTOMER_TOKEN_KEY: 'token' }, '@/lib/cart-stock': stock });
  let setLines, setNotices;
  const reconcileStock = (constraints) => {
    const result = stock.constrainCartStock(cart.items, constraints);
    setLines(result.items);
    setNotices((previous) => [...previous.filter((notice) => !notice.blocked && !result.adjustments.some((next) => next.productId === notice.productId)), ...result.adjustments]);
    return result;
  };
  function Host() {
    const [items, update] = React.useState([line(5)]), [notices, updateNotices] = React.useState([]);
    setLines = update; setNotices = updateNotices;
    cart = { items, stockAdjustments: notices, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), removedInvalidVariantLines: [], clearRemovedInvalidVariantLines() {},
      reconcileStock, removeItem() {}, updateQuantity(productId, quantity) { const result = stock.constrainCartStock(items.map((item) => ({ ...item, quantity }))); update(result.items); updateNotices(result.adjustments); } };
    return React.createElement(Page);
  }
  const passthrough = (tag) => ({ __esModule: true, default: (props) => React.createElement(tag, props, props.children) });
  const imports = { ...reactImports, 'next/link': passthrough('a'), 'next/image': passthrough('img'),
    'lucide-react': Object.fromEntries(['Trash2', 'Minus', 'Plus', 'ArrowLeft', 'ArrowRight', 'ShoppingBag', 'CreditCard', 'Landmark', 'WalletCards'].map((name) => [name, (props) => React.createElement('svg', props)])),
    '@/contexts/CartContext': { useCart: () => cart }, '@/contexts/CustomerAuthContext': { useCustomerAuth: () => ({ isApprovedPro: isPro }) },
    '@/lib/utils': { formatPrice: (amount) => `${amount.toFixed(2)} €` }, '@/lib/product-images': { getVariantImage: () => null },
    '@/lib/api': { validatePromotionCode: async () => ({ valid: false }) },
    '@/lib/checkout-pricing': { ...pricingBase, getCheckoutPricingQuote(args) { calls.push(args); return implementation(args); } },
    '@/components/CartSyncStatus': { __esModule: true, default: () => null },
    '@/components/PaymentBrandLogo': { __esModule: true, default: () => null, hasPaymentBrandLogo: () => false } };
  const { default: Page } = load('app/panier/page.tsx', imports, { window: { localStorage: globalsStorage(storage) }, sessionStorage: globalsStorage(session),
    fetch: async () => response({ options: [{ id: 'shipping', label: 'Livraison', price: 0, carrier: 'Test', days: '2 jours', isFree: true }] }) });
  const text = () => JSON.stringify(renderer.toJSON());
  const checkout = () => renderer.root.findByProps({ href: '/commande' });
  async function mount() { calls.length = 0; await act(async () => { renderer = create(React.createElement(Host)); await sleep(5); }); }
  async function flush() { await act(async () => { await sleep(5); }); }
  async function unmount() { await act(async () => { renderer.unmount(); }); }
  implementation = async ({ cartItems }) => quote(cartItems[0].quantity);
  await mount(); await flush();
  check(calls.length === 2 && calls[0].cartItems[0].quantity === 5 && calls[1].cartItems[0].quantity === 4, 'page reconciles5->4 and requests new quote exactly once');
  check(cart.items[0].quantity === 4 && text().includes('quantité ramenée de 5 à 4'), 'page shows stock notice');
  check(text().includes('Prix pro HT') && !text().includes('Public TTC') && checkout().props['aria-disabled'] === false, 'pro price preserved at threshold after correction');
  const quantityInput = renderer.root.findByProps({ 'aria-label': 'Quantité de Produit test' });
  check(quantityInput.props.max === 4 && renderer.root.findByProps({ 'aria-label': 'Augmenter la quantité de Produit test' }).props.disabled, 'input max and plus stock cap');
  session.set('barberparadise-payment-method', 'card');
  act(() => checkout().props.onClick({ preventDefault() { throw new Error('should navigate'); } }));
  check(!session.has('barberparadise-payment-method'), 'no default payment method persisted without explicit choice');
  const fail = deferred(); implementation = () => fail.promise;
  await act(async () => { quantityInput.props.onChange({ target: { value: '3' } }); });
  check(text().includes('Dernier tarif confirmé') && !text().includes('Public TTC') && checkout().props['aria-disabled'], 'inflight change retains confirmed pro price with stale marker');
  await act(async () => { fail.reject(new Error('Service indisponible 500')); }); await flush();
  check(text().includes('Service indisponible 500') && text().includes('Dernier tarif confirmé') && !text().includes('Calcul...') && checkout().props['aria-disabled'], '500 preserves last good quote, no infinite pricing Calcul');
  let prevented = false; act(() => checkout().props.onClick({ preventDefault() { prevented = true; } }));
  check(prevented, 'disabled CTA prevents checkout navigation');
  implementation = async ({ cartItems }) => quote(cartItems[0].quantity, 4, 'retail');
  const retry = renderer.root.findAllByType('button').find((node) => node.children.join('').includes('Réessayer'));
  await act(async () => { retry.props.onClick(); await sleep(5); }); await flush();
  check(calls.at(-1).cartItems[0].quantity === 3 && text().includes('Public TTC') && !text().includes('Service indisponible 500') && !checkout().props['aria-disabled'], 'manual retry recovers and respects below-threshold retail rule');
  await unmount();
  implementation = async () => { throw new Error('HTTP500 initial'); };
  await mount();
  check(text().includes('HTTP500 initial') && text().includes('—') && !text().includes('Public TTC') && !text().includes('180.00') && checkout().props['aria-disabled'], 'initial quote failure has dashes, no public fallback or endless Calculation');
  await unmount();
  // Real helper under the page: a non-settling fetch is bounded by the production15s timer (accelerated in this isolated harness).
  let aborted = false;
  const boundedPricing = load('lib/checkout-pricing.ts', { '@/lib/api': { API_URL: 'mock' }, '@/lib/customer-api': { CUSTOMER_TOKEN_KEY: 'token' }, '@/lib/cart-stock': stock },
    { window: { localStorage: globalsStorage(storage) }, fetch: async (_, init) => { init.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); },
      setTimeout: (fn, delay) => setTimeout(fn, delay === 15000 ? 5 : delay), clearTimeout });
  implementation = boundedPricing.getCheckoutPricingQuote;
  await mount(); await flush();
  check(aborted && text().includes('expiré') && text().includes('Réessayer') && !text().includes('Vérification du tarif et du stock…') && checkout().props['aria-disabled'], 'pricing stall becomes actionable error after bounded timeout');
  await unmount();
  implementation = async ({ cartItems }) => quote(cartItems[0].quantity, 0);
  await mount(); await flush();
  check(cart.items[0].quantity === 5 && text().includes('Rupture de stock') && renderer.root.findByProps({ 'aria-label': 'Quantité de Produit test' }).props.disabled && checkout().props['aria-disabled'], 'stock0 quoted but line remains visible with controls and checkout blocked');
  await unmount();
  isPro = false; implementation = async ({ cartItems }) => quote(cartItems[0].quantity, null, 'retail', false);
  await mount(); await flush();
  check(calls.length === 1 && calls[0].isB2B === false && cart.items[0].quantity === 5 && !checkout().props['aria-disabled'], 'retail authoritative nullable stock is not clamped or permanently blocked');
  await unmount();
}
(async () => { pureTests(); await pricingTests(); await contextTests(); await pageTests(); console.log(`PASS ${checks} assertions: stock, atomic context, signed drafts, pro preservation, retry500, pricing timeout, CTA, payment intent.`); })().catch((error) => { console.error(error); process.exitCode = 1; });

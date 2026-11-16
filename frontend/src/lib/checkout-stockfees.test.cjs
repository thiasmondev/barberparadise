// Run from repository root: REACT_TEST_NODE_MODULES=/tmp/customer-carts-tests/node_modules node frontend/src/lib/checkout-stockfees.test.cjs
// All fetch, storage, SDK and customer data are synthetic. No live network or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require(path.resolve(__dirname, '../../node_modules/typescript'));
const reactRequire = process.env.REACT_TEST_NODE_MODULES ? createRequire(path.resolve(process.env.REACT_TEST_NODE_MODULES, '../package.json')) : require;
const React = reactRequire('react');
const { create, act } = reactRequire('react-test-renderer');
const jsx = reactRequire('react/jsx-runtime');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function load(file, imports = {}, globals = {}) {
  const sandbox = { exports: {}, require(name) { if (name in imports) return imports[name]; throw new Error(`Unmocked import: ${name}`); }, process: { env: { NEXT_PUBLIC_API_URL: 'https://mock.invalid' } }, console, Error, setTimeout, clearTimeout, AbortController, URLSearchParams, ...globals };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, sandbox);
  return sandbox.exports;
}
const helperFile = path.join(__dirname, 'checkout-stockfees.ts');
async function helperTests() {
  let impl;
  const helper = load(helperFile, {}, { fetch: (...args) => impl(...args) });
  let aborted = false;
  await assert.rejects(helper.withCheckoutTimeout(signal => { signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }, { timeoutMs: 5 }), /trop de temps/);
  check(aborted, 'timeout aborts even hanging request and settles');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(helper.withCheckoutTimeout(() => Promise.resolve(1), { signal: controller.signal }), { name: 'AbortError' }); checks++;
  const issues = helper.getDraftStockIssues([{ id: 'p', name: 'Produit', quantity: 5, availableStock: 2, price: 17 }]);
  check(issues[0].availableStock === 2 && helper.getAvailableDisplayQuantity(5, issues[0]) === 2, 'draft display-only clamp');
  check(helper.getDraftStockIssues([{ id: 'p', name: 'Produit', quantity: 5, availableStock: null, variants: [{ id: 'v', stock: 0 }], variantId: 'v' }]).length === 0, 'explicit unknown stock does not fall back to a misleading variant zero');
  let request;
  const canonical = { baseTotalTTC: 99.99, paymentFeeTTC: 2.38, totalTTC: 102.37, paymentFeePercent: 2.38, stockIssues: [] };
  impl = async (url, init) => { request = { url, init }; return response(canonical); };
  const quote = await helper.getCheckoutFeeQuote({ apiUrl: 'mock', payload: { paymentMethod: 'card', draftToken: 'token', shippingOptionId: 'pickup' } });
  check(quote.totalTTC === 102.37 && quote.paymentFeeTTC === 2.38, 'exact canonical cents preserved without local recomputation');
  check(request.url === 'mock/api/checkout/payment-quote' && JSON.parse(request.init.body).draftToken === 'token', 'backend contract and draft preserved');
  impl = async () => response({ baseTotalTTC: 1 });
  await assert.rejects(helper.getCheckoutFeeQuote({ apiUrl: 'mock', payload: {} }), /incomplet/); checks++;
  impl = async () => response({ error: 'Momentanément indisponible' }, 503);
  await assert.rejects(helper.getCheckoutFeeQuote({ apiUrl: 'mock', payload: {} }), /Momentanément/); checks++;
}

const product = { id: 'p', name: 'Produit TEST', brand: 'TEST', price: 120, pricePublic: 120, stockCount: 20, inStock: true, variants: [], images: [] };
function pricing(items, isB2B, { availableStock = 20, pro = true } = {}) {
  return { isB2B, pricingTier: isB2B && pro ? 'pro' : 'retail', thresholdHT: 200, qualifyingSubtotalHT: 220, remainingHT: 0, progressPercent: 100,
    items: items.map(item => ({ ...item, retailUnitTTC: 120, retailUnitHT: 100, proUnitHT: 80, appliedUnitHT: isB2B && pro ? 80 : 100, appliedUnitTTC: isB2B && pro ? 96 : 120, priceSource: isB2B && pro ? 'pro' : 'retail', availableStock })),
    subtotalHT: isB2B && pro ? 240 : 300, subtotalTTC: isB2B && pro ? 288 : 360, vatRate: 20, vatAmount: isB2B && pro ? 48 : 60, discountTotal: 0, totalTTC: isB2B && pro ? 288 : 360,
    stockIssues: availableStock < items[0].quantity ? [{ productId: 'p', variantId: null, requestedQuantity: items[0].quantity, availableStock, code: 'INSUFFICIENT_STOCK', message: 'Stock insuffisant' }] : [] };
}
async function pageTests() {
  let renderer, config, calls, fetchImpl, cart, auth, params, storage, lastReplaceOptions, quoteImpl, quoteCalls;
  const globals = { fetch: (url, init) => { calls.push({ url, init, payload: init?.body ? JSON.parse(init.body) : undefined }); return fetchImpl(url, init); },
    window: { location: { href: '' }, localStorage: { getItem: key => storage.get(key) ?? null } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} } } };
  const helper = load(helperFile, {}, globals);
  const boundedHelper = { ...helper, withCheckoutTimeout: (request, options) => helper.withCheckoutTimeout(request, { ...options, timeoutMs: 35 }), getCheckoutFeeQuote: options => helper.getCheckoutFeeQuote({ ...options, timeoutMs: 35 }) };
  const icon = props => React.createElement('i', props);
  const icons = new Proxy({}, { get: () => icon });
  function reconcile(constraints) {
    let changed = false;
    const nextItems = cart.items.map(item => {
      const constraint = constraints.find(stock => stock.productId === item.product.id);
      if (!constraint) return item;
      const stock = constraint.availableStock;
      const quantity = stock > 0 ? Math.min(item.quantity, stock) : item.quantity;
      if (quantity !== item.quantity) {
        changed = true;
        cart.stockAdjustments = [{ productId: 'p', variantId: null, requestedQuantity: item.quantity, quantity, availableStock: stock, blocked: false, message: `Plus que ${stock} en stock · quantité ramenée de ${item.quantity} à ${quantity}` }];
      }
      if (stock === 0) cart.stockAdjustments = [{ productId: 'p', variantId: null, requestedQuantity: item.quantity, quantity, availableStock: stock, blocked: true, message: 'Rupture de stock' }];
      return quantity === item.quantity ? item : { ...item, quantity };
    });
    if (changed) cart.items = nextItems;
    if (changed && renderer) renderer.update(React.createElement(Page));
    return { items: cart.items, adjustments: cart.stockAdjustments, quantitiesChanged: changed, changed };
  }
  const pricingModule = { getCheckoutPricingQuote: options => { quoteCalls.push(options); return quoteImpl(options); },
    getPricingQuoteItem: (quote, productId, variantId) => quote?.items.find(item => item.productId === productId && (item.variantId || null) === (variantId || null)),
    getPricingQuoteStockConstraints: quote => quote.items.map(item => ({ productId: item.productId, variantId: item.variantId, availableStock: item.availableStock })) };
  const imports = { react: React, 'react/jsx-runtime': jsx, 'next/link': props => React.createElement('a', props), 'next/image': () => null, 'next/navigation': { useSearchParams: () => params },
    'lucide-react': icons, '@/contexts/CartContext': { useCart: () => cart }, '@/contexts/CustomerAuthContext': { useCustomerAuth: () => auth },
    '@/lib/customer-api': { getCustomerAddresses: async () => [] }, '@/lib/utils': { formatPrice: amount => `${Number(amount).toFixed(2)} €` },
    '@/lib/product-images': { getVariantImage: () => null }, '@/lib/api': { validatePromotionCode: async () => ({ valid: true, discount: 5 }) },
    '@/lib/checkout-pricing': pricingModule, '@/lib/checkout-stockfees': boundedHelper,
    '@/lib/checkout-display': { formatRelayDistance: String, formatShippingDisplayLabel: String }, '@/components/PaymentBrandLogo': { default: () => null, hasPaymentBrandLogo: () => false } };
  const Page = load(path.resolve(__dirname, '../app/commande/page.tsx'), imports, globals).default;
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(text).join(' '); return text(node.children ?? node.props?.children); }
  function allText() { return text(renderer.toJSON()); }
  function button(label) { const found = renderer.root.findAllByType('button').find(node => text(node.props.children).includes(label)); if (!found) throw new Error('No button '+label+' in '+allText()); return found; }
  async function click(label) { await act(async () => { button(label).props.onClick(); await sleep(8); }); }
  async function flush(ms = 12) { await act(async () => { await sleep(ms); }); }
  async function mount(options = {}) {
    config = options; calls = []; quoteCalls = []; renderer = null; lastReplaceOptions = null;
    params = new URLSearchParams(options.draft ? 'draftToken=synthetic-shared-token' : '');
    storage = new Map([['barberparadise-payment-method', 'paypal'], ['bp_customer_token', 'synthetic']]);
    auth = { customer: options.pro ? { id: 'synthetic', email: 'test@example.test' } : null, isAuthenticated: Boolean(options.pro), isLoading: false, isApprovedPro: Boolean(options.pro) };
    cart = { items: [{ product, quantity: 3, variantId: null }], cartSessionId: 'synthetic-cart', stockAdjustments: [], reconcileStock: reconcile,
      replaceItems(next, opts) { cart.items = next; lastReplaceOptions = opts; } };
    quoteImpl = async ({ cartItems, isB2B }) => pricing(cartItems, isB2B, options.pricing || {});
    fetchImpl = async (url, init) => {
      if (url.includes('/available-methods')) return response({ methods: ['card', 'paypal', 'paybybank'], surcharges: { card: 2.9, paypal: 4 } });
      if (url.includes('/shipping-options')) return response({ options: [{ id: 'shipping', label: 'Standard', price: 5, carrier: 'standard', days: '2', isFree: false }] });
      if (url.includes('/paypal/v2/config')) return response({ v2Enabled: false });
      if (url.includes('/cart-session')) return response({ ok: true });
      if (url.includes('/draft/')) return response({ draft: config.draft });
      if (url.includes('/payment-quote')) return response(config.fee || { baseTotalTTC: options.pro ? 293 : 365, paymentFeeTTC: 8.49, totalTTC: 301.49, paymentFeePercent: 2.9, stockIssues: [] });
      if (url.includes('/initiate')) return response({ checkoutUrl: 'https://mock.invalid/payment' });
      throw new Error('Unexpected mocked route '+url);
    };
    await act(async () => { renderer = create(React.createElement(Page)); await sleep(5); }); await flush();
  }
  async function unmount() { await act(async () => renderer.unmount()); renderer = null; }
  const draft = { orderNumber: 'DRAFT-TEST', email: 'test@example.test', isB2B: true, noShipping: true, subtotal: 100, shipping: 0, total: 108, totalHT: 90, vatRate: 20, vatAmount: 18, totalTTC: 108, discountTotal: 10,
    items: [{ id: 'p', productId: 'p', name: 'Produit TEST', price: 20, quantity: 5, discountedLineTotal: 90, discountAmount: 10, availableStock: 2, inStock: true }] };
  await mount({ draft });
  check(allText().includes('Prix brouillon') && allText().includes('90.00 €') && allText().includes('108.00 €'), 'guest draft shortage preserves labels, net line and frozen TTC');
  check(allText().includes('5 demandé(s), 2 disponible(s)') && allText().includes('Offre initiale conservée'), 'clear display-only reduced quantity and notice');
  check(lastReplaceOptions.preserveDraftQuantities && cart.items[0].quantity === 5, 'financial quantity retained; CartContext preservation option used');
  check(!calls.some(call => call.url.includes('/payment-quote')), 'first draft render no fees, ignoring stored method');
  await click('Carte bancaire');
  check(button('PAYER').props.disabled, 'draft shortage payment remains blocked after choice');
  const draftPreview = calls.find(call => call.url.includes('/payment-quote'));
  check(draftPreview.payload.cartItems[0].quantity === 5 && draftPreview.payload.draftToken, 'draft quote uses original signed financial lines');
  check(quoteCalls.length === 0, 'draft shortages never fall back to catalogue pricing quote');
  config.draft = { ...draft, items: [{ ...draft.items[0], quantity: 2, availableStock: 2, price: 30, discountAmount: 0, discountedLineTotal: 60 }], subtotal: 60, totalHT: 60, vatAmount: 12, totalTTC: 72, total: 72, discountTotal: 0 };
  config.fee = { baseTotalTTC: 72, paymentFeeTTC: 2.09, totalTTC: 74.09, paymentFeePercent: 2.9, stockIssues: [] };
  await click('Recharger l’offre corrigée'); await flush();
  check(allText().includes('74.09 €') && !allText().includes('Offre initiale conservée'), 'reloading corrected BDD offer clears shortage and gets new exact fee quote');
  check(!button('PAYER').props.disabled, 'corrected reloaded draft can pay, with chosen method');
  await unmount();

  await mount({ pro: true, draft });
  check(allText().includes('Prix brouillon') && allText().includes('90.00 €') && button('PAYER').props.disabled, 'approved pro draft preserves snapshot and blocks shortage');
  await unmount();

  await mount({ pro: true });
  check(!calls.some(call => call.url.includes('/payment-quote')) && !allText().includes('Base TTC avant frais'), 'first pro render has no fee quote despite stored paypal/default card');
  await act(async () => {
    for (const input of renderer.root.findAllByType('input')) if (input.props.type !== 'email') input.props.onChange?.({ target: { value: 'synthetic-address' } });
    await sleep(8);
  });
  await click('CONTINUER VERS LE PAIEMENT');
  check(button('PAYER').props.disabled, 'payment disabled until explicit checkout choice');
  await click('Carte bancaire');
  check(allText().includes('301.49 €') && allText().includes('293.00 €') && allText().includes('8.49 €'), 'canonical base fee total visible');
  check(!button('PAYER').props.disabled, 'exact current canonical quote permits payment');
  await click('VOIR');
  check((allText().match(/301.49 €/g) || []).length >= 4 && (allText().match(/Base TTC avant frais/g) || []).length === 2, 'same canonical total/base in mobile, desktop, header and pay button');
  const oldFetch = fetchImpl;
  fetchImpl = async (url, init) => url.includes('/initiate') ? response({ code: 'PAYMENT_QUOTE_CHANGED', error: 'PAYMENT_QUOTE_CHANGED' }, 409) : oldFetch(url, init);
  await click('PAYER');
  check(calls.find(call => call.url.includes('/initiate')).payload.expectedTotalTTC === 301.49, 'initiate sends exact fresh canonical expectedTotalTTC, not recalculated browser value');
  check(allText().includes('Le montant a été mis à jour. Vérifiez le total puis confirmez à nouveau.') && button('PAYER').props.disabled, 'canonical price drift has clear French copy and blocks payment pending explicit requote confirmation');
  check(!allText().includes('PAYMENT_QUOTE_CHANGED') && !allText().includes('SKU'), 'no technical code or pricing jargon rendered to the customer');
  fetchImpl = oldFetch;
  await click('Réessayer les frais');
  check(!button('PAYER').props.disabled, 'explicit fee requote resolves drift block');
  fetchImpl = async (url, init) => url.includes('/payment-quote') ? response({ error: 'Frais indisponibles TEST' }, 503) : oldFetch(url, init);
  await click('PayPal');
  check(allText().includes('Frais indisponibles TEST') && allText().includes('301.49 €') && button('PAYER').props.disabled, 'fee error retains last quote and blocks payment: '+allText());
  fetchImpl = oldFetch; config.fee = { baseTotalTTC: 293, paymentFeeTTC: 11.72, totalTTC: 304.72, paymentFeePercent: 4, stockIssues: [] };
  await click('Réessayer les frais');
  check(allText().includes('304.72 €') && !button('PAYER').props.disabled, 'manual retry replaces exact canonical quote and unblocks');
  const hang = deferred();
  fetchImpl = async (url, init) => url.includes('/payment-quote') && JSON.parse(init.body).paymentMethod === 'card' ? hang.promise : oldFetch(url, init);
  await click('Carte bancaire'); await click('Virement instantané');
  config.fee = { baseTotalTTC: 293, paymentFeeTTC: 0, totalTTC: 293, paymentFeePercent: 0, stockIssues: [] };
  hang.resolve(response({ baseTotalTTC: 293, paymentFeeTTC: 99, totalTTC: 392, stockIssues: [] })); await flush();
  check(!allText().includes('392.00 €'), 'stale aborted fee response cannot overwrite new method quote');
  fetchImpl = async (url, init) => url.includes('/payment-quote') ? new Promise(() => {}) : oldFetch(url, init);
  await click('Carte bancaire'); await flush(45);
  check(allText().includes('trop de temps') && !allText().includes('Vérification du total et des frais…') && button('PAYER').props.disabled, 'fee timeout exits loading with retry and no infinite calculation');
  await unmount();

  await mount({ pro: true });
  const lastPrice = allText();
  quoteImpl = async () => { throw new Error('Tarif indisponible TEST'); };
  await act(async () => { cart.items = [{ ...cart.items[0], quantity: 4 }]; renderer.update(React.createElement(Page)); await sleep(10); });
  check(allText().includes('Derniers prix conservés') && allText().includes('Prix pro HT') && allText().includes('293.00 €'), 'pricing update/error never globally reverts to retail');
  quoteImpl = async ({ cartItems, isB2B }) => pricing(cartItems, isB2B);
  await click('Réessayer le calcul');
  check(!allText().includes('Tarif indisponible TEST'), 'pricing retry recovers');
  await unmount();

  await mount({ pro: true, pricing: { availableStock: 2 } }); await flush();
  check(cart.items[0].quantity === 2 && quoteCalls.some(call => call.cartItems[0].quantity === 2), 'standard CartContext clamps then checkout requotes corrected quantities');
  check(allText().includes('quantité ramenée de 3 à 2'), 'standard correction notice persists on line');
  await unmount();
}
(async () => { await helperTests(); await pageTests(); console.log(`PASS ${checks} synthetic assertions: actual React checkout renders, draft/pro/guest stock freeze, canonical fees, explicit selection, mobile/desktop totals, errors/retries, timeout, stale response and CartContext requote.`); })().catch(error => { console.error(error); process.exitCode = 1; });

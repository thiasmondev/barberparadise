// Run from repository root:
// REACT_TEST_NODE_MODULES=/tmp/customer-carts-tests/node_modules node frontend/src/lib/cart-session-sync.test.cjs
// Or install react-test-renderer@18.3.1 in an isolated test directory and point the env var there.
// Every fetch and storage operation is mocked: no live network or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const ts = require(path.resolve(root, '../node_modules/typescript'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
const timestamp = '2026-11-09T13:00:00.000Z';
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
function ack(payload, extra = {}) {
  return { ok: true, sessionId: payload.sessionId, hasSnapshot: Array.isArray(payload.cartItems),
    ...(Array.isArray(payload.cartItems) ? { itemCount: payload.cartItems.reduce((sum, line) => sum + line.quantity, 0), syncedAt: timestamp, validationIssues: [] } : {}), ...extra };
}
function load(source, imports = {}, globals = {}) {
  const sandbox = { exports: {}, require(name) { return name in imports ? imports[name] : require(name); },
    process: { env: { NEXT_PUBLIC_API_URL: 'https://local-test.invalid' } }, console, setTimeout, clearTimeout,
    AbortController, Headers, Date, Promise, JSON, Set, crypto: require('node:crypto').webcrypto, ...globals };
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, sandbox);
  return sandbox.exports;
}
const queueSource = fs.readFileSync(path.join(__dirname, 'cart-session-sync.ts'), 'utf8');
const { createCartSessionSyncQueue } = load(queueSource);
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; }
function request(quantity = 1, token = 'a') { return { token, payload: { sessionId: 'session', email: 'client@example.test', cartItems: [{ productId: 'p', variantId: null, quantity }] } }; }

async function queueTests() {
  for (const kind of ['network', 500, 429]) {
    let calls = 0;
    const queue = createCartSessionSyncQueue({ url: 'mock', retryDelayMs: 1, fetch: async () => { calls++; if (kind === 'network') throw new TypeError('offline'); return response({}, kind); } });
    const result = await queue.enqueue(() => request());
    check(result.status === 'error' && calls === 4, `initial + max three retries: ${kind}`);
  }
  for (const status of [400, 401, 403, 404, 422]) {
    let calls = 0;
    const queue = createCartSessionSyncQueue({ url: 'mock', retryDelayMs: 1, fetch: async () => { calls++; return response({}, status); } });
    check((await queue.enqueue(() => request())).status === 'error' && calls === 1, `no retry on ${status}`);
  }
  let current = request(1, 'a');
  const bodies = [];
  const queue = createCartSessionSyncQueue({ url: 'mock', retryDelayMs: 1, fetch: async (_, init) => {
    const payload = JSON.parse(init.body); bodies.push({ payload, token: init.headers.Authorization });
    if (bodies.length === 1) { current = request(3, 'b'); return response({}, 503); }
    return response(ack(payload));
  } });
  check((await queue.enqueue(() => current)).status === 'success', 'retry recovers');
  check(bodies[1].payload.cartItems[0].quantity === 3 && bodies[1].token === 'Bearer b', 'retry recalculates articles and token');
  let concurrent = 0, maxConcurrent = 0;
  const serial = createCartSessionSyncQueue({ url: 'mock', fetch: async (_, init) => { maxConcurrent = Math.max(maxConcurrent, ++concurrent); await sleep(2); concurrent--; return response(ack(JSON.parse(init.body))); } });
  await Promise.all([serial.enqueue(() => request()), serial.enqueue(() => request(2))]);
  check(maxConcurrent === 1, 'requests are serialized');
  let hungCalls = 0;
  const bounded = createCartSessionSyncQueue({ url: 'mock', timeoutMs: 5, retryDelayMs: 1, fetch: async () => { hungCalls++; return new Promise(() => {}); } });
  check((await bounded.enqueue(() => request())).status === 'error' && hungCalls === 4, 'timeout releases queue even when fetch does not settle');
  let stale = true, staleCalls = 0;
  const invalid = createCartSessionSyncQueue({ url: 'mock', retryDelayMs: 1, fetch: async () => { staleCalls++; stale = false; return response({}, 500); } });
  check((await invalid.enqueue(() => stale ? request() : null)).status === 'skipped' && staleCalls === 1, 'invalidated tasks are not retried');
  let invalidBodyCalls = 0;
  const protocol = createCartSessionSyncQueue({ url: 'mock', retryDelayMs: 1, fetch: async () => { invalidBodyCalls++; return response({ ok: true }); } });
  check((await protocol.enqueue(() => request())).status === 'error' && invalidBodyCalls === 1, 'invalid protocol is not silently synced/retried');
  let bodyCalls = 0;
  const bodyNetwork = createCartSessionSyncQueue({ url: 'mock', retryDelayMs: 1, fetch: async (_, init) => {
    bodyCalls++;
    if (bodyCalls === 1) return { ok: true, status: 200, json: async () => { throw new TypeError('connection interrupted'); } };
    return response(ack(JSON.parse(init.body)));
  } });
  check((await bodyNetwork.enqueue(() => request())).status === 'success' && bodyCalls === 2, 'network interruption while reading body is retried');
  let aborted = false;
  const timeoutSignal = createCartSessionSyncQueue({ url: 'mock', timeoutMs: 5, maxRetries: 0, fetch: async (_, init) => {
    init.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {});
  } });
  check((await timeoutSignal.enqueue(() => request())).status === 'error' && aborted, 'timeout aborts underlying fetch');
}

async function hookTests() {
  const reactRequire = process.env.REACT_TEST_NODE_MODULES
    ? createRequire(path.resolve(process.env.REACT_TEST_NODE_MODULES, '../package.json')) : createRequire(path.resolve(root, '../package.json'));
  const React = reactRequire('react');
  const { create, act } = reactRequire('react-test-renderer');
  const imports = { react: React, 'react/jsx-runtime': reactRequire('react/jsx-runtime'), '@/lib/customer-api': { CUSTOMER_TOKEN_KEY: 'bp_customer_token' } };
  const product = { id: 'p', name: 'Produit', price: 10, variants: [] };
  let storage, calls, impl, cart, renderer;
  const browser = new EventTarget();
  const doc = new EventTarget(); doc.visibilityState = 'visible';
  const nav = { onLine: true };
  const mockedFetch = async (url, init) => { const payload = JSON.parse(init.body); calls.push({ url, payload, token: init.headers.Authorization }); return impl(payload, init); };
  const syncModule = load(queueSource, {}, { fetch: mockedFetch });
  // Short delays for failure/recovery tests only; production defaults remain 15s/3 retries.
  const testSync = { ...syncModule, createCartSessionSyncQueue(options) { return syncModule.createCartSessionSyncQueue({ ...options, timeoutMs: 25, retryDelayMs: 1 }); } };
  const globals = { fetch: mockedFetch, window: browser, document: doc, navigator: nav,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) } };
  const context = load(fs.readFileSync(path.join(root, 'contexts/CartContext.tsx'), 'utf8'), { ...imports, '@/lib/cart-session-sync': testSync }, globals);
  function Probe() { cart = context.useCart(); return null; }
  async function mount(lines = [{ product, quantity: 1, variantId: null }]) {
    storage = new Map([['barberparadise-cart', JSON.stringify(lines)], ['barberparadise-cart-session', 'session'], ['bp_customer_token', 'a']]);
    calls = []; nav.onLine = true; doc.visibilityState = 'visible';
    await act(async () => { renderer = create(React.createElement(context.CartProvider, null, React.createElement(Probe))); await sleep(3); });
  }
  async function flush(ms = 10) { await act(async () => { await sleep(ms); }); }
  async function unmount() { await act(async () => { renderer.unmount(); }); }

  impl = async (payload) => response(ack(payload));
  await mount(); await flush();
  check(cart.items.length === 1 && cart.syncStatus === 'synced' && cart.lastSyncedAt === timestamp, 'hydrated full snapshot acknowledged');
  check(calls.filter((call) => call.payload.cartItems).every((call) => call.payload.cartItems.length === 1), 'no initial destructive empty snapshot');
  await unmount();

  impl = async () => { throw new TypeError('offline provider details'); };
  await mount(); await flush(30);
  check(cart.syncStatus === 'error' && cart.items.length === 1 && JSON.parse(storage.get('barberparadise-cart')).length === 1, 'offline failure preserves cart and local storage');
  check(!cart.syncMessage.includes('provider') && calls.length === 4, 'generic error and bounded retries');
  impl = async (payload) => response(ack(payload));
  const beforeRecover = calls.length;
  await act(async () => { for (let i = 0; i < 10; i++) { browser.dispatchEvent(new Event('online')); doc.dispatchEvent(new Event('visibilitychange')); } await sleep(380); });
  await flush();
  check(cart.syncStatus === 'synced' && calls.length === beforeRecover + 1, 'online/visible event burst debounced into one retry');
  await unmount();

  const pending = deferred(); let first = true;
  impl = async (payload) => { if (first) { first = false; await pending.promise; } return response(ack(payload)); };
  await mount();
  await act(async () => { storage.set('bp_customer_token', 'b'); cart.updateCartEmail(' CLIENT@example.test '); pending.resolve(); });
  await flush();
  const latest = calls[calls.length - 1];
  check(latest.token === 'Bearer b' && latest.payload.email === 'client@example.test' && latest.payload.cartItems.length === 1, 'auth token change repairs snapshot as well as identity');
  check(calls.some((call) => call.payload.email && !('cartItems' in call.payload)), 'identity association never sends []');
  check(cart.syncStatus === 'synced', 'only latest authenticated snapshot marked synced');
  const beforeForce = calls.length;
  await act(async () => { cart.syncCartNow(); }); await flush();
  check(calls.length === beforeForce + 1 && calls.at(-1).payload.email === 'client@example.test', 'manual action forces full snapshot with current email/token');
  await unmount();

  impl = async (payload) => response(ack(payload, { hasSnapshot: false, syncedAt: undefined, itemCount: undefined }));
  await mount(); await flush();
  check(cart.syncStatus !== 'synced' && cart.lastSyncedAt === null, 'identity-only acknowledgment cannot mark snapshot synced');
  await unmount();

  impl = async (payload) => response(ack(payload, { validationIssues: ['VARIANT_REQUIRED:p'] }));
  await mount(); await flush();
  check(cart.syncStatus === 'error' && cart.syncMessage.includes('Articles à vérifier') && cart.items.length === 1, 'validation warning preserves items and avoids misleading synced status');
  await unmount();

  let replacement = true;
  impl = async (payload) => { if (replacement && payload.email && payload.cartItems) { replacement = false; return response(ack(payload, { sessionId: 'replacement' })); } return response(ack(payload)); };
  await mount(); await flush();
  await act(async () => { cart.updateCartEmail('client@example.test'); }); await flush();
  check(cart.cartSessionId === 'replacement' && storage.get('barberparadise-cart-session') === 'replacement', 'server-issued session adopted');
  check(calls.at(-1).payload.sessionId === 'replacement' && calls.at(-1).payload.email === 'client@example.test' && calls.at(-1).payload.cartItems.length === 1, 'replacement preserves email/items and resends full snapshot');
  check(cart.syncStatus === 'synced', 'replacement snapshot acknowledged');
  await unmount();

  const articleWrite = deferred(); let articleFirst = true;
  impl = async (payload) => { if (articleFirst) { articleFirst = false; await articleWrite.promise; } return response(ack(payload)); };
  await mount();
  await act(async () => { cart.updateQuantity('p', 4); articleWrite.resolve(); }); await flush();
  check(calls.at(-1).payload.cartItems[0].quantity === 4 && cart.syncStatus === 'synced', 'in-flight stale articles cannot be marked synced');
  await unmount();

  const sessionWrite = deferred(); let sessionFirst = true;
  impl = async (payload) => { if (sessionFirst) { sessionFirst = false; await sessionWrite.promise; } return response(ack(payload)); };
  await mount();
  await act(async () => { cart.syncCartNow(); cart.rotateCartSession(); sessionWrite.resolve(); }); await flush();
  check(cart.cartSessionId !== 'session' && calls.filter((call) => call.payload.sessionId === 'session').length === 1, 'queued old-session tasks invalidated on rotation');
  check(cart.items.length === 1 && cart.syncStatus === 'synced', 'session rotation keeps articles and synchronizes new session');
  await unmount();

  // Reproduction of pre-fix HEAD: token change invalidates a queued snapshot,
  // updateCartEmail only sends identity, leaving the server without articles.
  const beforePath = process.env.CART_AUDIT_BEFORE;
  if (beforePath) {
    const old = load(fs.readFileSync(beforePath, 'utf8'), imports, globals);
    function OldProbe() { cart = old.useCart(); return null; }
    storage = new Map([['barberparadise-cart', JSON.stringify([{ product, quantity: 1 }])], ['barberparadise-cart-session', 'old'], ['bp_customer_token', 'a']]);
    calls = []; impl = async (payload) => response(ack(payload));
    act(() => { renderer = create(React.createElement(old.CartProvider, null, React.createElement(OldProbe))); });
    storage.set('bp_customer_token', 'b');
    await act(async () => { cart.updateCartEmail('client@example.test'); }); await flush();
    check(cart.items.length === 1 && calls.length === 1 && !('cartItems' in calls[0].payload), 'AUDIT PROVED: token-change drops queued snapshot, only identity survives');
    await unmount();
  }
}

(async () => { await queueTests(); await hookTests(); console.log(`PASS ${checks} assertions: retries/timeouts, stale bodies, HTTP policy, real React hydration, offline recovery, auth repair, force snapshot, identity replies, validation and new session.`); })().catch((error) => { console.error(error); process.exitCode = 1; });

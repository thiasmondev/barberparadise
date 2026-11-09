// Run: node frontend/src/lib/order-discounts.test.cjs
// Pure tests. No network, database, browser, or runtime writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../node_modules/typescript');
const root = path.resolve(__dirname, '..');
function load(source, globals = {}) {
  const sandbox = { exports: {}, console, ...globals };
  vm.createContext(sandbox);
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, sandbox);
  return sandbox;
}
function functions(file, names) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = {};
  (function walk(node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found[node.name.text] = node.getText(ast);
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) found[node.name.getText(ast)] = `const ${node.getText(ast)};`;
    ts.forEachChild(node, walk);
  })(ast);
  assert.equal(Object.keys(found).length, names.length, `real functions found in ${file}`);
  return names.map((name) => found[name]).join('\n');
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const helpers = load(fs.readFileSync(path.join(__dirname, 'order-discounts.ts'), 'utf8')).exports;
const { calculateLineDiscount, lineDiscountFields, orderDiscountFields, orderItemToDraftPayload } = helpers;
assert.equal(calculateLineDiscount('fixed', 10, 300), 10, 'fixed is once per line regardless of quantity');
assert.equal(calculateLineDiscount('percent', 10, 300), 30, 'percentage is on gross line');
assert.equal(calculateLineDiscount('fixed', 500, 300), 300, 'clamped at line gross');
assert.equal(calculateLineDiscount('percent', 150, 300), 300, 'percentage capped');
assert.deepEqual(plain(lineDiscountFields({ lineDiscountValue: 0, discountAmount: 12 })), { lineDiscountType: null, lineDiscountValue: null }, 'explicit zero is not replaced by stale amount');
assert.deepEqual(plain(lineDiscountFields({ discountAmount: 12 })), { lineDiscountType: 'fixed', lineDiscountValue: 12 });
const item = { id: 'line', productId: 'fixture', name: 'Fixture', price: 100, quantity: 3, lineDiscountType: 'fixed', lineDiscountValue: 10, discountAmount: 10 };
const source = { discountAmount: 10, discountTotal: 10, orderDiscountType: null, orderDiscountValue: null, items: [item] };
for (const channel of ['online', 'pos', undefined]) {
  assert.equal(orderDiscountFields({ ...source, channel }).orderDiscountValue, null, 'line-only aggregate never becomes global');
  assert.equal(orderDiscountFields({ ...source, channel, discountTotal: undefined }).orderDiscountValue, null, 'legacy aggregate also excludes lines');
}
assert.equal(orderDiscountFields({ ...source, discountTotal: 0 }).orderDiscountValue, null, 'zero aggregate falls back to historical amount and subtracts lines');
assert.equal(orderDiscountFields({ ...source, discountTotal: 25 }).orderDiscountValue, 15, 'preserves genuine residual global discount');
assert.equal(orderDiscountFields({ ...source, discountTotal: 25, orderDiscountValue: 0 }).orderDiscountValue, null, 'explicit global zero wins');
assert.deepEqual(plain(orderDiscountFields({ ...source, orderDiscountType: 'percent', orderDiscountValue: 15 })), { orderDiscountType: 'percent', orderDiscountValue: 15 }, 'keeps percent input, not computed amount');
assert.equal(orderDiscountFields({ discountAmount: 10, items: [{ price: 100, quantity: 3, lineDiscountType: 'fixed', lineDiscountValue: 10 }] }).orderDiscountValue, null, 'can subtract line metadata when computed amount absent');
assert.equal(orderDiscountFields({ discountAmount: 3, items: [{ discountAmount: 10 }] }).orderDiscountValue, null, 'no negative residual');
const custom = { ...item, productId: null, isCustomSale: true, customVatRate: 0 };
assert.equal(orderDiscountFields({ ...source, channel: 'pos', items: [custom], orderDiscountType: 'fixed', orderDiscountValue: 10 }).orderDiscountValue, null, 'historical POS quick-sale mirror remains a single line discount');
assert.equal(orderDiscountFields({ ...source, channel: 'pos', items: [custom], discountTotal: 15, orderDiscountType: 'fixed', orderDiscountValue: 5 }).orderDiscountValue, 5, 'genuine global beyond a custom line is not cleared');
assert.deepEqual(plain(orderItemToDraftPayload(custom)), { isCustomItem: true, customName: 'Fixture', customPriceTTC: 100, customVatRate: 0, quantity: 3, lineDiscountType: 'fixed', lineDiscountValue: 10 }, 'custom snapshot and zero VAT retained');
const draftFile = path.join(root, 'app/admin/commandes/brouillons/page.tsx');
const draft = load(functions(draftFile, ['unitPrice', 'numericValue', 'discountAmount', 'lineGrossTotal', 'lineDiscountAmount', 'draftToForm', 'buildPayload']), { ...helpers, emptyAddress: { country: 'FR' } });
const fixture = { ...source, email: 'fixture@example.invalid', shipping: 0, isB2B: false, noShipping: true, items: [item] };
draft.form = draft.draftToForm(fixture);
let payload = draft.buildPayload();
assert.equal(payload.orderDiscountValue, null, 'actual draftToForm/buildPayload does not add a global');
assert.equal(payload.items[0].lineDiscountValue, 10);
assert.equal(draft.lineDiscountAmount(draft.form.items[0], false), 10);
assert.equal(draft.lineGrossTotal(draft.form.items[0], false) - draft.lineDiscountAmount(draft.form.items[0], false), 290);
draft.form = draft.draftToForm(fixture); // save-response/reopen cycle
assert.equal(draft.buildPayload().orderDiscountValue, null, 'idempotent reopening');
// User-specified product/percentage, but price/quantity are synthetic test-only values.
const osakaFixture = { ...fixture, discountAmount: 40, discountTotal: 40, items: [{ ...item, name: 'YLS Osaka', price: 100, quantity: 2, lineDiscountType: 'percent', lineDiscountValue: 20, discountAmount: 40 }] };
draft.form = draft.draftToForm(osakaFixture);
payload = draft.buildPayload();
assert.equal(payload.items[0].lineDiscountType, 'percent', 'YLS Osaka preserves percentage type');
assert.equal(payload.items[0].lineDiscountValue, 20, 'YLS Osaka preserves 20% input');
assert.equal(payload.orderDiscountType, null, 'YLS Osaka line percentage is not copied globally');
assert.equal(payload.orderDiscountValue, null);
assert.equal(draft.lineDiscountAmount(draft.form.items[0], false), 40, '20% computed only once on fictitious gross');
draft.form = draft.draftToForm({ ...fixture, items: [custom] });
payload = draft.buildPayload();
assert.equal(payload.items[0].isCustomItem, true);
assert.equal(payload.items[0].customPriceTTC, 100);
assert.equal(payload.items[0].customVatRate, 0);
assert.equal(payload.items[0].lineDiscountValue, 10);
assert.equal(draft.lineGrossTotal(draft.form.items[0], false), 300, 'custom price does not reset to zero after save');

async function pagePayloadTests() {
  let sent;
  const noop = () => {};
  const pageFile = path.join(root, 'app/admin/commandes/[id]/page.tsx');
  const page = load(functions(pageFile, ['handleSaveOrder', 'handleModifyItemsSubmit']), {
    ...helpers, order: { ...fixture, id: 'order', status: 'paid', vatRate: 20, items: [item, custom] },
    editForm: { email: 'fixture@example.invalid', notes: 'address only', shippingAddress: {}, billingAddress: {} },
    sanitizeEditableAddress: (value) => value, updateAdminOrder: async (id, payload) => { sent = { id, payload }; return { ...fixture, id }; },
    setSaving: noop, setOrder: noop, setShipment: noop, setNotes: noop, setEditForm: noop, setEditMode: noop, buildEditForm: (order) => order, alert: (error) => { throw Error(error); },
    editableItems: [{ productId: 'custom', name: 'Fixture custom', isCustomItem: true, customPriceTTC: '100', customVatRate: '0', quantity: 3, lineDiscountType: 'fixed', lineDiscountValue: '10' }],
    modifyAdjustmentMode: 'internal', setModifyItemsLoading: noop, setModifyItemsError: (error) => { if (error) throw Error(error); },
    modifyOrderItems: async (id, payload) => { sent = { id, payload }; return { oldTotal: 300, newTotal: 300, diff: 0, order: {} }; },
    setModifyItemsResult: noop, setModifyDoneMessage: noop, setModifyItemsStep: noop,
  });
  await vm.runInContext('handleSaveOrder()', page);
  assert.equal(sent.payload.orderDiscountValue, null);
  assert.equal(sent.payload.items[0].lineDiscountValue, 10, 'address/notes save retains catalogue discount');
  assert.equal(sent.payload.items[1].isCustomItem, true, 'address save does not convert custom item to catalogue');
  assert.equal(sent.payload.items[1].lineDiscountValue, 10);
  assert.equal(sent.payload.items[1].customPriceTTC, 100);
  assert.equal(sent.payload.items[1].customVatRate, 0);
  await vm.runInContext('handleModifyItemsSubmit()', page);
  assert.equal(sent.payload.items[0].lineDiscountValue, 10, 'custom modification includes discount');
  assert.equal(sent.payload.items[0].customVatRate, 0);
  const requests = [];
  const api = load(functions(path.join(__dirname, 'admin-api.ts'), ['getAdminOrderDiscounts', 'previewAdminOrderDiscounts', 'updateAdminOrderDiscounts']), { adminFetch: async (url, options) => { requests.push({ url, options }); return {}; } });
  const discountPayload = { expectedUpdatedAt: 'fixture-version', orderDiscountType: null, orderDiscountValue: null, items: [{ id: 'line', lineDiscountType: null, lineDiscountValue: null }] };
  await api.getAdminOrderDiscounts('order/id');
  await api.previewAdminOrderDiscounts('order/id', discountPayload);
  await api.updateAdminOrderDiscounts('order/id', discountPayload);
  assert.deepEqual(requests.map((request) => request.url), ['/api/admin/orders/order%2Fid/discounts', '/api/admin/orders/order%2Fid/discounts/preview', '/api/admin/orders/order%2Fid/discounts']);
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[2].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(requests[2].options.body), discountPayload, 'null clear and optimistic version preserved at HTTP boundary');
  console.log('✓ order-discounts: pure helpers, actual draft round-trip, address-save payload and custom-modification payload passed (synthetic fixtures, zero HTTP calls).');
}
pagePayloadTests().catch((error) => { console.error(error); process.exitCode = 1; });

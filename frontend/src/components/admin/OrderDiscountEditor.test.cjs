// Run from repo root:
// REACT_TEST_NODE_MODULES=/tmp/customer-carts-tests/node_modules node frontend/src/components/admin/OrderDiscountEditor.test.cjs
// Or install react-test-renderer@18.3.1 in an isolated folder and point REACT_TEST_NODE_MODULES there.
// No browser/network/database. All three discount endpoints are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const reactRequire = process.env.REACT_TEST_NODE_MODULES ? createRequire(path.resolve(process.env.REACT_TEST_NODE_MODULES, '../package.json')) : createRequire(path.join(root, 'package.json'));
const React = reactRequire('react');
const { act, create } = reactRequire('react-test-renderer');
const source = fs.readFileSync(path.join(__dirname, 'OrderDiscountEditor.tsx'), 'utf8');
let calls = [], getError, patchError, saved, closed;
const state = { orderId: 'fixture', updatedAt: '2026-01-01T00:00:00.000Z', oldTotal: 100, paidAmount: 80, priceTaxLabel: 'TTC', orderDiscountType: null, orderDiscountValue: null, items: [{ id: 'line', name: 'Article fictif', quantity: 2, price: 60, lineDiscountType: 'fixed', lineDiscountValue: 20, priceTaxLabel: 'TTC' }] };
let currentState = state;
let preview = { oldTotal: 100, newTotal: 90, diff: -10, subtotal: 90, totalHT: 75, vatAmount: 15, totalTTC: 90, discountTotal: 30, remainingAmount: 10, overpaidAmount: 0 };
const api = {
  async getAdminOrderDiscounts(id) { calls.push(['GET', id]); if (getError) throw Error(getError); return currentState; },
  async previewAdminOrderDiscounts(id, payload) { calls.push(['POST preview', id, JSON.parse(JSON.stringify(payload))]); return preview; },
  async updateAdminOrderDiscounts(id, payload) { calls.push(['PATCH', id, JSON.parse(JSON.stringify(payload))]); if (patchError) throw Error(patchError); return { ...preview, order: { id, total: preview.newTotal, paidAmount: currentState.paidAmount } }; },
};
const imports = { react: React, 'react/jsx-runtime': reactRequire('react/jsx-runtime'), 'lucide-react': { Loader2: () => null, X: () => null }, '@/lib/admin-api': api };
const sandbox = { exports: {}, console, Error, require(name) { assert.ok(name in imports, `no financial or unexpected module loaded: ${name}`); return imports[name]; } };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, sandbox);
const Editor = sandbox.exports.default;
let renderer;
const text = (node) => typeof node === 'string' ? node : !node ? '' : (Array.isArray(node) ? node.map(text).join(' ') : text(node.children));
function button(label) { return renderer.root.findAllByType('button').find((node) => text(node.props.children).includes(label)); }
async function click(label) { const node = button(label); assert.ok(node, label); assert.ok(!node.props.disabled, `${label} is enabled`); await act(async () => { await node.props.onClick(); }); }
async function mount() { calls = []; saved = null; closed = false; await act(async () => { renderer = create(React.createElement(Editor, { orderId: 'fixture', onSaved: (order) => { saved = order; closed = true; }, onClose: () => { closed = true; } })); }); }
async function unmount() { await act(async () => { renderer.unmount(); }); }
(async () => {
  await mount();
  assert.deepEqual(calls.map((call) => call[0]), ['GET']);
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Remise — Article fictif' }).props.value, '20', 'canonical line input');
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Remise — commande' }).props.value, '', 'canonical no-global input');
  await act(async () => { renderer.root.findByProps({ 'aria-label': 'Remise — Article fictif' }).props.onChange({ target: { value: '30' } }); });
  await click('Prévisualiser');
  assert.deepEqual(calls.map((call) => call[0]), ['GET', 'POST preview'], 'preview never saves');
  assert.equal(saved, null);
  assert.deepEqual(calls[1][2], { expectedUpdatedAt: state.updatedAt, orderDiscountType: null, orderDiscountValue: null, items: [{ id: 'line', lineDiscountType: 'fixed', lineDiscountValue: 30 }] }, 'payload has ids/discounts/version only, no price/qty/payment');
  assert.ok(text(renderer.toJSON()).includes('Déjà payé — inchangé'));
  assert.ok(text(renderer.toJSON()).includes('régénérez-la'));
  await click('Retour aux remises');
  assert.equal(calls.length, 2, 'back is not a save');
  await click('Prévisualiser');
  await click('Confirmer la correction');
  assert.deepEqual(calls.map((call) => call[0]), ['GET', 'POST preview', 'POST preview', 'PATCH']);
  assert.deepEqual(calls[3][2], calls[2][2], 'confirmation uses exact previewed payload');
  assert.equal(saved.paidAmount, 80);
  assert.equal(saved.total, 90);
  assert.equal(closed, true);
  await unmount();

  patchError = 'La commande a changé pendant la correction.';
  await mount(); await click('Prévisualiser'); await click('Confirmer la correction');
  assert.equal(saved, null, 'conflict is not successful');
  assert.equal(closed, false, 'conflict stays visible');
  assert.ok(text(renderer.root.findByProps({ role: 'alert' }).props.children).includes('La commande a changé'));
  assert.ok(text(renderer.root.findByProps({ role: 'alert' }).props.children).includes('rouvrez'));
  await unmount(); patchError = null;

  getError = 'Un lien de paiement est encore actif.';
  await mount();
  assert.ok(text(renderer.root.findByProps({ role: 'alert' }).props.children).includes('lien de paiement'));
  assert.equal(button('Prévisualiser').props.disabled, true);
  assert.deepEqual(calls.map((call) => call[0]), ['GET']);
  await unmount(); getError = null;

  currentState = { ...state, paidAmount: null, priceTaxLabel: 'HT', items: [{ ...state.items[0], priceTaxLabel: 'TTC' }] };
  preview = { ...preview, remainingAmount: null, overpaidAmount: null };
  await mount();
  await act(async () => { renderer.root.findByProps({ 'aria-label': 'Remise — Article fictif' }).props.onChange({ target: { value: '' } }); });
  await click('Prévisualiser');
  assert.equal(calls[1][2].items[0].lineDiscountType, null);
  assert.equal(calls[1][2].items[0].lineDiscountValue, null, 'clear is explicit null, not omitted');
  assert.ok(text(renderer.toJSON()).includes('à vérifier — payé non renseigné'));
  await unmount();

  currentState = state;
  await mount();
  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Type de remise — commande' }).props.onChange({ target: { value: 'percent' } });
  });
  await act(async () => { renderer.root.findByProps({ 'aria-label': 'Remise — commande' }).props.onChange({ target: { value: '101' } }); });
  await click('Prévisualiser');
  assert.equal(calls.length, 1, 'invalid percent rejected before API call');
  assert.ok(text(renderer.root.findByProps({ role: 'alert' }).props.children).includes('entre 0 et 100'));
  await unmount();
  console.log('✓ OrderDiscountEditor: canonical GET, edit→preview→explicit PATCH, version conflict, active payment lock, unknown balance, explicit clear and invalid percent passed. Zero live HTTP calls or payment APIs.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

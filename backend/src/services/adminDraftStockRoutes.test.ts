import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from '../utils/prisma';
import { adminRouter } from '../routes/admin';

async function run() {
  process.env.ADMIN_JWT_SECRET = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign({ id: 'fixture-admin', role: 'admin' }, process.env.ADMIN_JWT_SECRET);
  const product = { id: 'fixture-product', name: 'Article synthétique', status: 'active', stockCount: 4, inStock: true, price: 60, priceProEur: 40, images: '[]', variants: [] };
  const draft = { id: 'fixture-draft', status: 'draft', email: 'recipient@example.test', customerEmail: 'recipient@example.test', customer: null, total: 240, totalTTC: 240, items: [{ id: 'line-fixture', productId: product.id, name: product.name, variantId: null, quantity: 5, price: 40, discountAmount: 0, product }] };
  const original = { orderFind: prisma.order.findUnique, orderUpdate: prisma.order.update, orderCreate: prisma.order.create, products: prisma.product.findMany };
  let writes = 0;
  Object.assign(prisma.order, { findUnique: async () => structuredClone(draft), update: async () => { writes++; throw new Error('Unexpected write'); }, create: async () => { writes++; throw new Error('Unexpected write'); } });
  Object.assign(prisma.product, { findMany: async () => [structuredClone(product)] });
  const before = JSON.stringify(draft);
  const app = express(); app.use(express.json()); app.use('/api/admin', adminRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  try {
    const loaded = await fetch(base + '/api/admin/orders/drafts/fixture-draft', { headers });
    const result = await loaded.json() as any;
    assert.equal(loaded.status, 200);
    assert.equal(result.draft.total, 240);
    assert.equal(result.draft.items[0].price, 40);
    assert.equal(result.draft.items[0].quantity, 5);
    assert.equal(result.draft.stockIssues[0].availableStock, 4);
    const send = await fetch(base + '/api/admin/orders/drafts/fixture-draft/send', { method: 'POST', headers, body: '{}' });
    assert.equal(send.status, 409);
    assert.ok(((await send.json()) as any).error.includes('plus que 4 en stock'));
    assert.equal(writes, 0, 'Pas de token généré/renouvelé ni envoi après blocage');
    const create = await fetch(base + '/api/admin/orders/drafts', { method: 'POST', headers, body: JSON.stringify({ email: 'recipient@example.test', isB2B: true, noShipping: true, items: [{ productId: product.id, quantity: 5 }] }) });
    assert.equal(create.status, 400);
    assert.ok(((await create.json()) as any).error.includes('plus que 4 en stock'));
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(draft), before, 'Offre et quantités originales conservées');
    console.log('Tests HTTP admin stock réussis : création/envoi refusés, diagnostics visibles, offre inchangée.');
  } finally {
    Object.assign(prisma.order, { findUnique: original.orderFind, update: original.orderUpdate, create: original.orderCreate });
    Object.assign(prisma.product, { findMany: original.products });
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

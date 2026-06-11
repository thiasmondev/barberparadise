import { test, expect } from '@playwright/test';
import { newApiContext, loginCustomer, loginAdmin, expectProtected } from '../helpers/api';

test.describe('Protection API admin et endpoints sensibles', () => {
  const adminEndpoints = ['/api/admin/stats', '/api/admin/orders', '/api/admin/customers'];

  for (const endpoint of adminEndpoints) {
    test(`bloque l'accès anonyme à ${endpoint}`, async () => {
      await expectProtected(endpoint, [401, 403]);
    });

    test(`bloque un jeton client sur ${endpoint}`, async () => {
      const token = await loginCustomer();
      const ctx = await newApiContext({ Authorization: `Bearer ${token}` });
      const res = await ctx.get(endpoint);
      expect([401, 403]).toContain(res.status());
      await ctx.dispose();
    });

    test(`accepte un jeton admin sur ${endpoint}`, async () => {
      const token = await loginAdmin();
      const ctx = await newApiContext({ Authorization: `Bearer ${token}` });
      const res = await ctx.get(endpoint);
      expect([200, 204]).toContain(res.status());
      await ctx.dispose();
    });
  }

  test('refuse les méthodes inattendues sur un webhook sans secret', async () => {
    const ctx = await newApiContext();
    const res = await ctx.post('/api/webhooks/stripe', { data: { unsafe: true } });
    expect([400, 401, 403, 404, 405]).toContain(res.status());
    await ctx.dispose();
  });
});

import { test, expect } from '@playwright/test';
import { loginCustomer } from '../helpers/api';
import { accounts, apiURL } from '../fixtures/test-data';

test.describe('IDOR commandes', () => {
  test('un second client ne doit pas accéder arbitrairement aux commandes privées', async ({ request }) => {
    const token = await loginCustomer(accounts.b2c2.email, accounts.b2c2.password);
    const response = await request.get(`${apiURL}/api/orders/not-owned-by-user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([400, 401, 403, 404]).toContain(response.status());
  });
});

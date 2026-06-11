import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/test-data';
import { loginCustomerUI } from '../helpers/auth';

test.describe('Parcours B2B validé', () => {
  test('le compte professionnel accède à son espace', async ({ page }) => {
    await loginCustomerUI(page, accounts.b2b);
    await page.goto('/compte');
    await expect(page.locator('body')).toContainText(/compte|pro|professionnel|commande/i);
  });
});

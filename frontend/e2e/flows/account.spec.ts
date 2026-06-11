import { test, expect } from '@playwright/test';
import { loginCustomerUI } from '../helpers/auth';

test.describe('Espace client', () => {
  test('le client connecté accède à son compte', async ({ page }) => {
    await loginCustomerUI(page);
    await page.goto('/compte');
    await expect(page.locator('body')).toContainText(/compte|profil|commande|adresse/i);
  });
});

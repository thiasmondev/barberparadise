import { test, expect } from '@playwright/test';

test.describe('Sécurité paiement - mode non destructif', () => {
  test('ne lance pas de paiement réel depuis les tests E2E', async ({ page }) => {
    await page.goto('/panier');
    await expect(page.locator('body')).not.toContainText(/paiement confirmé|payment succeeded/i);
  });
});

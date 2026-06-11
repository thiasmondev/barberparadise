import { test, expect } from '@playwright/test';

test.describe('Parcours B2C non destructif', () => {
  test('navigation catalogue vers panier', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/panier');
    await expect(page.locator('body')).toContainText(/panier|vide|commande|total/i);
  });
});

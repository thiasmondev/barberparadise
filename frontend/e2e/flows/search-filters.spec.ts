import { test, expect } from '@playwright/test';

test.describe('Recherche et filtres', () => {
  test('la recherche accepte une requête simple sans erreur visible', async ({ page }) => {
    await page.goto('/recherche?q=tondeuse');
    await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error|Application error/i);
  });
});

import { test, expect } from '@playwright/test';

test.describe('Responsive mobile', () => {
  test('la navigation mobile charge la page d’accueil', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error|Application error/i);
  });
});

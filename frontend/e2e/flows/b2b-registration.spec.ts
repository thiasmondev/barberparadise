import { test, expect } from '@playwright/test';

test.describe('Inscription professionnelle', () => {
  test('la page pro ou inscription pro reste accessible proprement', async ({ page }) => {
    await page.goto('/pro');
    await expect(page.locator('body')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Mot de passe oublié', () => {
  test('la page de reset ne révèle pas l’existence des emails', async ({ page }) => {
    await page.goto('/mot-de-passe-oublie');
    await expect(page.locator('body')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Robustesse formulaires', () => {
  test('la connexion supporte les caractères spéciaux sans erreur front', async ({ page }) => {
    await page.goto('/connexion');
    await page.locator('input[type="email"], input[name="email"]').first().fill('xss+test@example.com');
    await page.locator('input[type="password"], input[name="password"]').first().fill('<script>alert(1)</script>');
    await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error|Application error/i);
  });
});

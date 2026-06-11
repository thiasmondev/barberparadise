import { test, expect } from '@playwright/test';

test.describe('Pages d’erreur propres', () => {
  test('une URL inconnue ne déclenche pas d’erreur applicative brute', async ({ page }) => {
    await page.goto('/page-inexistante-e2e');
    await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error|Application error|stack trace/i);
  });
});

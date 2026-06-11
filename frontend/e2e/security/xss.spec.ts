import { test, expect } from '@playwright/test';
import { xssPayloads } from '../fixtures/test-data';

test.describe('Anti-XSS basique', () => {
  for (const payload of xssPayloads) {
    test(`ne déclenche pas de dialogue avec payload ${payload.slice(0, 18)}`, async ({ page }) => {
      let dialogTriggered = false;
      page.on('dialog', async (dialog) => { dialogTriggered = true; await dialog.dismiss(); });
      await page.goto(`/recherche?q=${encodeURIComponent(payload)}`);
      await page.waitForLoadState('domcontentloaded');
      expect(dialogTriggered).toBe(false);
    });
  }
});

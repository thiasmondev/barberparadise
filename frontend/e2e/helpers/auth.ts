import { expect, Page } from '@playwright/test';
import { accounts } from '../fixtures/test-data';

export async function loginCustomerUI(page: Page, account = accounts.b2c): Promise<void> {
  await page.goto('/connexion');
  await page.locator('input[type="email"], input[name="email"]').first().fill(account.email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(account.password);
  await page.getByRole('button', { name: /connexion|se connecter/i }).first().click();
  await expect(page).not.toHaveURL(/\/connexion$/, { timeout: 15_000 });
}

export async function loginAdminUI(page: Page): Promise<void> {
  await page.goto('/admin');
  await page.locator('input[type="email"], input[name="email"]').first().fill(accounts.admin.email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(accounts.admin.password);
  await page.getByRole('button', { name: /connexion|se connecter/i }).first().click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
}

export async function assertNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForLoadState('networkidle').catch(() => undefined);
  expect(errors.filter((e) => !/favicon|hydration/i.test(e))).toEqual([]);
}

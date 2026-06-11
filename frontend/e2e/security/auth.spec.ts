import { test, expect } from '@playwright/test';
import { accounts } from '../fixtures/test-data';
import { loginCustomerUI } from '../helpers/auth';

test.describe('Authentification et sessions', () => {
  test('un client B2C peut se connecter', async ({ page }) => {
    await loginCustomerUI(page, accounts.b2c);
    await expect(page.locator('body')).toContainText(/compte|profil|commande|déconnexion/i);
  });

  test('un client B2B validé peut se connecter', async ({ page }) => {
    await loginCustomerUI(page, accounts.b2b);
    await expect(page.locator('body')).toContainText(/compte|pro|professionnel|commande|déconnexion/i);
  });

  test('un mauvais mot de passe ne connecte pas', async ({ page }) => {
    await page.goto('/connexion');
    await page.locator('input[type="email"], input[name="email"]').first().fill(accounts.b2c.email);
    await page.locator('input[type="password"], input[name="password"]').first().fill('MauvaisMotDePasse!2026');
    await page.getByRole('button', { name: /connexion|se connecter/i }).first().click();
    await expect(page).toHaveURL(/\/connexion/);
  });
});

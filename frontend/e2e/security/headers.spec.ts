import { test, expect } from '@playwright/test';
import { apiURL } from '../fixtures/test-data';

test.describe('En-têtes de sécurité', () => {
  test('le frontend expose les headers essentiels', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'Réponse frontend absente').not.toBeNull();
    const headers = response!.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/i);
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('le backend ne divulgue pas Express et renvoie des headers sûrs', async ({ request }) => {
    const response = await request.get(`${apiURL}/api/products`);
    const headers = response.headers();
    expect(headers['x-powered-by']).toBeFalsy();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});

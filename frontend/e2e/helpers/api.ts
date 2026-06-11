import { APIRequestContext, request, expect } from '@playwright/test';
import { accounts, apiURL } from '../fixtures/test-data';

export async function newApiContext(extraHeaders: Record<string, string> = {}): Promise<APIRequestContext> {
  return request.newContext({ baseURL: apiURL, extraHTTPHeaders: extraHeaders });
}

export async function loginCustomer(email = accounts.b2c.email, password = accounts.b2c.password): Promise<string> {
  const ctx = await newApiContext({ 'Content-Type': 'application/json' });
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `Connexion client impossible pour ${email}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return body.token || body.accessToken || body.jwt;
}

export async function loginAdmin(email = accounts.admin.email, password = accounts.admin.password): Promise<string> {
  const ctx = await newApiContext({ 'Content-Type': 'application/json' });
  const res = await ctx.post('/api/auth/admin/login', { data: { email, password } });
  expect(res.ok(), `Connexion admin impossible pour ${email}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return body.token || body.accessToken || body.jwt;
}

export async function expectProtected(pathname: string, allowedStatuses = [401, 403]): Promise<void> {
  const ctx = await newApiContext();
  const res = await ctx.get(pathname);
  expect(allowedStatuses, `${pathname} devrait être protégé, statut reçu: ${res.status()}`).toContain(res.status());
  await ctx.dispose();
}

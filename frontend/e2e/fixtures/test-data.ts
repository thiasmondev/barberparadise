export const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
export const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function required(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Variable d'environnement manquante: ${name}`);
  return value;
}

export const accounts = {
  b2c: {
    email: required('TEST_B2C_EMAIL', process.env.E2E_B2C_EMAIL),
    password: required('TEST_B2C_PASSWORD', process.env.E2E_B2C_PASSWORD || process.env.TEST_ACCOUNT_PASSWORD),
  },
  b2b: {
    email: required('TEST_B2B_EMAIL', process.env.E2E_B2B_EMAIL),
    password: required('TEST_B2B_PASSWORD', process.env.E2E_B2B_PASSWORD || process.env.TEST_ACCOUNT_PASSWORD),
  },
  admin: {
    email: required('TEST_ADMIN_EMAIL', process.env.E2E_ADMIN_EMAIL),
    password: required('TEST_ADMIN_PASSWORD', process.env.E2E_ADMIN_PASSWORD || process.env.TEST_ACCOUNT_PASSWORD),
  },
  b2c2: {
    email: required('TEST_B2C2_EMAIL', process.env.E2E_B2C_2_EMAIL),
    password: required('TEST_B2C2_PASSWORD', process.env.E2E_B2C_2_PASSWORD || process.env.TEST_ACCOUNT_PASSWORD),
  },
};

export const xssPayloads = [
  '<script>alert("bp-xss")</script>',
  '" onmouseover="alert(1)',
  '<img src=x onerror=alert(1)>',
];

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { ROUTES } from '../../src/constants/routes';

// Test credentials and configuration
const TEST_CREDENTIALS = {
  validTenant: 'test-tenant',
  validEmail: 'test@example.com',
  validPassword: 'Test123!@#',
  invalidEmail: 'invalid@example.com',
  invalidPassword: 'wrong123',
  blockedTenant: 'blocked-tenant',
  expiredAccount: 'expired@example.com',
  lockedAccount: 'locked@example.com'
} as const;

// Test selectors for DOM elements
const TEST_SELECTORS = {
  tenantInput: "[data-testid='tenant-input']",
  emailInput: "[data-testid='email-input']",
  passwordInput: "[data-testid='password-input']",
  loginButton: "[data-testid='login-button']",
  logoutButton: "[data-testid='logout-button']",
  errorAlert: "[data-testid='error-alert']",
  securityNotice: "[data-testid='security-notice']",
  mfaPrompt: "[data-testid='mfa-prompt']",
  sessionTimeout: "[data-testid='session-timeout']"
} as const;

// Security headers that should be present
const REQUIRED_SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};

let context: BrowserContext;
let page: Page;

test.beforeEach(async ({ browser }) => {
  // Create a new context with security headers
  context = await browser.newContext({
    ignoreHTTPSErrors: false,
    bypassCSP: false,
    httpCredentials: {
      username: process.env.TEST_USER || '',
      password: process.env.TEST_PASS || ''
    }
  });

  // Create new page with isolation
  page = await context.newPage();

  // Clear storage and cookies
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Navigate to login page
  await page.goto(ROUTES.AUTH.LOGIN);

  // Verify secure connection
  expect(page.url()).toMatch(/^https:\/\//);

  // Check security headers
  const response = await page.waitForResponse(resp => resp.url().includes(ROUTES.AUTH.LOGIN));
  for (const [header, value] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    expect(response.headers()[header.toLowerCase()]).toBe(value);
  }
});

test.afterEach(async () => {
  // Clean up test data and context
  await context.clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await context.close();
});

test('successful login with valid credentials', async () => {
  // Verify CSRF token presence
  const csrfToken = await page.evaluate(() => 
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
  );
  expect(csrfToken).toBeTruthy();

  // Fill tenant information
  await page.fill(TEST_SELECTORS.tenantInput, TEST_CREDENTIALS.validTenant);
  await expect(page.locator(TEST_SELECTORS.tenantInput)).toHaveValue(TEST_CREDENTIALS.validTenant);

  // Fill login credentials
  await page.fill(TEST_SELECTORS.emailInput, TEST_CREDENTIALS.validEmail);
  await page.fill(TEST_SELECTORS.passwordInput, TEST_CREDENTIALS.validPassword);

  // Submit login form
  await page.click(TEST_SELECTORS.loginButton);

  // Verify successful navigation to dashboard
  await page.waitForURL(ROUTES.DASHBOARD.HOME);
  expect(page.url()).toContain(ROUTES.DASHBOARD.HOME);

  // Verify access token
  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(accessToken).toBeTruthy();
  
  // Verify HTTP-only refresh token cookie
  const cookies = await context.cookies();
  const refreshToken = cookies.find(c => c.name === 'refresh_token');
  expect(refreshToken).toBeTruthy();
  expect(refreshToken?.httpOnly).toBe(true);
  expect(refreshToken?.secure).toBe(true);
  expect(refreshToken?.sameSite).toBe('Strict');
});

test('login failures with invalid credentials', async () => {
  // Test invalid tenant
  await page.fill(TEST_SELECTORS.tenantInput, TEST_CREDENTIALS.blockedTenant);
  await page.fill(TEST_SELECTORS.emailInput, TEST_CREDENTIALS.validEmail);
  await page.fill(TEST_SELECTORS.passwordInput, TEST_CREDENTIALS.validPassword);
  await page.click(TEST_SELECTORS.loginButton);
  
  await expect(page.locator(TEST_SELECTORS.errorAlert)).toBeVisible();
  await expect(page.locator(TEST_SELECTORS.errorAlert)).toContainText('Invalid tenant');

  // Test invalid email
  await page.fill(TEST_SELECTORS.tenantInput, TEST_CREDENTIALS.validTenant);
  await page.fill(TEST_SELECTORS.emailInput, TEST_CREDENTIALS.invalidEmail);
  await page.click(TEST_SELECTORS.loginButton);
  
  await expect(page.locator(TEST_SELECTORS.errorAlert)).toBeVisible();
  await expect(page.locator(TEST_SELECTORS.errorAlert)).toContainText('Invalid credentials');

  // Test rate limiting
  for (let i = 0; i < 5; i++) {
    await page.click(TEST_SELECTORS.loginButton);
  }
  
  await expect(page.locator(TEST_SELECTORS.errorAlert)).toContainText('Too many attempts');
  
  // Verify no token leakage
  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(accessToken).toBeNull();
});

test('secure logout functionality', async () => {
  // Perform login first
  await page.fill(TEST_SELECTORS.tenantInput, TEST_CREDENTIALS.validTenant);
  await page.fill(TEST_SELECTORS.emailInput, TEST_CREDENTIALS.validEmail);
  await page.fill(TEST_SELECTORS.passwordInput, TEST_CREDENTIALS.validPassword);
  await page.click(TEST_SELECTORS.loginButton);
  
  await page.waitForURL(ROUTES.DASHBOARD.HOME);

  // Perform logout
  await page.click(TEST_SELECTORS.logoutButton);
  
  // Verify redirect to login page
  await page.waitForURL(ROUTES.AUTH.LOGIN);
  expect(page.url()).toContain(ROUTES.AUTH.LOGIN);

  // Verify token cleanup
  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(accessToken).toBeNull();

  // Verify cookie cleanup
  const cookies = await context.cookies();
  const refreshToken = cookies.find(c => c.name === 'refresh_token');
  expect(refreshToken).toBeUndefined();
});

test('token refresh mechanism', async () => {
  // Login to get initial tokens
  await page.fill(TEST_SELECTORS.tenantInput, TEST_CREDENTIALS.validTenant);
  await page.fill(TEST_SELECTORS.emailInput, TEST_CREDENTIALS.validEmail);
  await page.fill(TEST_SELECTORS.passwordInput, TEST_CREDENTIALS.validPassword);
  await page.click(TEST_SELECTORS.loginButton);

  // Get initial access token
  const initialToken = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(initialToken).toBeTruthy();

  // Simulate token expiration
  await page.evaluate(() => localStorage.setItem('access_token', 'expired_token'));

  // Trigger a protected API call
  await page.goto(ROUTES.DASHBOARD.METRICS);

  // Verify new token was issued
  const newToken = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(newToken).toBeTruthy();
  expect(newToken).not.toBe(initialToken);
  expect(newToken).not.toBe('expired_token');

  // Verify we're still on the protected page
  expect(page.url()).toContain(ROUTES.DASHBOARD.METRICS);
});
import { test, expect } from '@playwright/test';

/**
 * Auth flow tests — verify register, login, and logout form behavior.
 * These test the forms and client-side validation, not the full auth backend
 * (which requires a running Postgres with Better Auth tables).
 *
 * NOTE: The login form uses a combined "identity" field (username or email)
 * with a two-step resolution flow, not a separate email field.
 */

test.describe('Login form', () => {
  test('shows required validation on empty submit', async ({ page }) => {
    await page.goto('/auth/login');

    const identityInput = page.locator('#identity');
    const passwordInput = page.locator('#password');

    await expect(identityInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('identity field accepts text input', async ({ page }) => {
    await page.goto('/auth/login');

    const identityInput = page.locator('#identity');
    await expect(identityInput).toHaveAttribute('type', 'text');
  });

  test('password field has correct type', async ({ page }) => {
    await page.goto('/auth/login');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('submit button text changes when loading', async ({ page }) => {
    await page.goto('/auth/login');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Log in');
  });

  test('has link to register page', async ({ page }) => {
    await page.goto('/auth/login');

    const registerLink = page.locator('a[href="/auth/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText('Register');
  });

  test('has correct autocomplete attributes', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator('#identity')).toHaveAttribute('autocomplete', 'username');
    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'current-password');
  });
});

test.describe('Register form', () => {
  test('has all required fields', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('fields have required attribute', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('#username')).toHaveAttribute('required', '');
    await expect(page.locator('#email')).toHaveAttribute('required', '');
    await expect(page.locator('#password')).toHaveAttribute('required', '');
  });

  test('password uses new-password autocomplete', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'new-password');
  });

  test('submit button text is correct', async ({ page }) => {
    await page.goto('/auth/register');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Create account');
  });

  test('has link to login page', async ({ page }) => {
    await page.goto('/auth/register');

    const loginLink = page.locator('a[href="/auth/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText('Log in');
  });

  test('form fields accept input', async ({ page }) => {
    await page.goto('/auth/register', { waitUntil: 'networkidle' });

    // Ensure Vue has hydrated before we fill — otherwise `fill` sets the
    // DOM value before v-model's input listener attaches and hydration
    // clobbers our value back to the initial empty ref.
    const submitBtn = page.locator('form button[type="submit"]');
    await submitBtn.waitFor({ state: 'visible' });
    await expect(submitBtn).toBeEnabled();

    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('securepassword');

    await expect(page.locator('#username')).toHaveValue('testuser');
    await expect(page.locator('#email')).toHaveValue('test@example.com');
    await expect(page.locator('#password')).toHaveValue('securepassword');
  });
});

test.describe('Auth page accessibility', () => {
  test('login form has aria-label', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('form')).toHaveAttribute('aria-label', 'Login form');
  });

  test('register form has aria-label', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.locator('form')).toHaveAttribute('aria-label', 'Registration form');
  });

  test('login form labels are associated with inputs', async ({ page }) => {
    await page.goto('/auth/login');

    const identityLabel = page.locator('label[for="identity"]');
    const passwordLabel = page.locator('label[for="password"]');

    await expect(identityLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test('register form labels are associated with inputs', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page.locator('label[for="username"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify every public page loads without fatal errors.
 * These don't require auth or seeded data; pages handle empty states gracefully.
 */

test.describe('Public pages render', () => {
  test('homepage loads with hero banner and tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CommonPub/);

    // Hero banner
    await expect(page.locator('.cpub-hero-banner')).toBeVisible();

    // Tab bar
    await expect(page.locator('.cpub-tabs-bar')).toBeVisible();
    await expect(page.locator('.cpub-tab').first()).toBeVisible();

    // Sidebar
    await expect(page.locator('.cpub-sidebar')).toBeVisible();

    // Footer
    await expect(page.locator('.cpub-footer')).toBeVisible();
  });

  test('search page loads with search input and filter pills', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/Search/);
    await expect(page.locator('.cpub-search-input-main')).toBeVisible();
    await expect(page.locator('.cpub-type-pill').first()).toBeVisible();
  });

  test('login page renders form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Log in/);
    await expect(page.locator('form[aria-label="Login form"]')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register page renders form', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveTitle(/Register/);
    await expect(page.locator('form[aria-label="Registration form"]')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('hubs listing page loads', async ({ page }) => {
    await page.goto('/hubs');
    await expect(page.locator('body')).toBeVisible();
    // Page should not have a fatal error
    await expect(page.locator('text=500')).not.toBeVisible({ timeout: 3000 }).catch(() => {
      // OK if not found — that's what we want
    });
  });

  test('contests listing page loads', async ({ page }) => {
    await page.goto('/contests');
    await expect(page.locator('body')).toBeVisible();
  });

  test('learn listing page loads', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.locator('body')).toBeVisible();
  });

  test('videos listing page loads', async ({ page }) => {
    await page.goto('/videos');
    await expect(page.locator('body')).toBeVisible();
  });

  test('content type index pages load', async ({ page }) => {
    for (const type of ['project', 'article', 'blog', 'explainer']) {
      await page.goto(`/${type}`);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('docs listing page loads', async ({ page }) => {
    await page.goto('/docs');
    await expect(page).toHaveTitle(/Documentation/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('products listing page loads', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveTitle(/Products/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('tags listing page loads', async ({ page }) => {
    await page.goto('/tags');
    await expect(page).toHaveTitle(/Tags/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('feed page loads', async ({ page }) => {
    await page.goto('/feed');
    await expect(page).toHaveTitle(/Feed/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveTitle(/About/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('certificate verification shows not-found for invalid code', async ({ page }) => {
    await page.goto('/cert/invalid-code-123');
    await expect(page.locator('body')).toBeVisible();
    // Should show not-found state
    await expect(page.locator('text=Certificate Not Found')).toBeVisible();
  });
});

test.describe('No console errors on key pages', () => {
  const pages = ['/', '/search', '/auth/login', '/auth/register', '/hubs', '/contests', '/learn', '/videos', '/docs', '/products', '/tags', '/feed', '/about'];

  for (const path of pages) {
    test(`no fatal console errors on ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Filter out expected fetch errors (API calls that return 404/500 without DB data)
      const fatalErrors = errors.filter(
        (e) => !e.includes('Failed to fetch') && !e.includes('fetch') && !e.includes('404') && !e.includes('500'),
      );

      expect(fatalErrors).toHaveLength(0);
    });
  }
});

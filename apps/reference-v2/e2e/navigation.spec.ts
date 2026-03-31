import { test, expect } from '@playwright/test';

/**
 * Navigation tests — verify client-side routing, link integrity, and tab interactions.
 */

test.describe('Homepage tab switching', () => {
  test('clicking tabs updates active state', async ({ page }) => {
    await page.goto('/');

    const tabs = page.locator('.cpub-tab');
    const firstTab = tabs.first();
    const secondTab = tabs.nth(1);

    await expect(firstTab).toHaveClass(/active/);

    await secondTab.click();
    await expect(secondTab).toHaveClass(/active/);
    await expect(firstTab).not.toHaveClass(/active/);
  });

  test('hero banner dismiss button works', async ({ page }) => {
    await page.goto('/');

    const banner = page.locator('.cpub-hero-banner');
    await expect(banner).toBeVisible();

    await page.locator('.cpub-hero-dismiss').click();
    await expect(banner).not.toBeVisible();
  });
});

test.describe('Footer links navigate correctly', () => {
  test('footer contains expected links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('.cpub-footer');
    await expect(footer).toBeVisible();

    await expect(footer.locator('a[href="/about"]')).toBeVisible();
    await expect(footer.locator('a[href="/docs"]')).toBeVisible();
    await expect(footer.locator('a[href="/api"]')).toBeVisible();
  });
});

test.describe('Auth page links', () => {
  test('login page links to register', async ({ page }) => {
    await page.goto('/auth/login');

    const registerLink = page.locator('a[href="/auth/register"]');
    await expect(registerLink).toBeVisible();

    await registerLink.click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('register page links to login', async ({ page }) => {
    await page.goto('/auth/register');

    const loginLink = page.locator('a[href="/auth/login"]');
    await expect(loginLink).toBeVisible();

    await loginLink.click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Search page interactions', () => {
  test('typing in search input works', async ({ page }) => {
    await page.goto('/search');

    const input = page.locator('.cpub-search-input-main');
    await input.fill('esp32');
    await expect(input).toHaveValue('esp32');
  });

  test('type filter pills switch active state', async ({ page }) => {
    await page.goto('/search');

    const pills = page.locator('.cpub-type-pill');
    const allPill = pills.first();
    const projectsPill = pills.nth(1);

    await expect(allPill).toHaveClass(/active/);

    await projectsPill.click();
    await expect(projectsPill).toHaveClass(/active/);
    await expect(allPill).not.toHaveClass(/active/);
  });

  test('advanced filters panel toggles', async ({ page }) => {
    await page.goto('/search');

    const filterBtn = page.locator('.cpub-adv-filter-btn');
    const panel = page.locator('.cpub-adv-panel');

    await expect(panel).not.toBeVisible();

    await filterBtn.click();
    await expect(panel).toBeVisible();

    await filterBtn.click();
    await expect(panel).not.toBeVisible();
  });

  test('search with query param pre-fills input', async ({ page }) => {
    await page.goto('/search?q=robotics');

    const input = page.locator('.cpub-search-input-main');
    await expect(input).toHaveValue('robotics');
  });
});

test.describe('Sidebar interactions on homepage', () => {
  test('sidebar stat blocks are visible', async ({ page }) => {
    await page.goto('/');

    const statBlocks = page.locator('.cpub-stat-block');
    await expect(statBlocks.first()).toBeVisible();
  });

  test('sidebar contest links navigate', async ({ page }) => {
    await page.goto('/');

    const contestsLink = page.locator('.cpub-sb-head a[href="/contests"]');
    if (await contestsLink.isVisible()) {
      await contestsLink.click();
      await expect(page).toHaveURL(/\/contests/);
    }
  });
});

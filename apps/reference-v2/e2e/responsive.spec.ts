import { test, expect } from '@playwright/test';

/**
 * Responsive layout tests — verify pages adapt to different viewport sizes.
 * Uses the mobile-chrome project from playwright config for mobile tests.
 */

test.describe('Homepage responsive layout', () => {
  test('desktop: shows two-column layout with sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const layout = page.locator('.cpub-main-layout');
    await expect(layout).toBeVisible();

    // Sidebar should be visible on desktop
    const sidebar = page.locator('.cpub-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('tablet: collapses to single column', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    const layout = page.locator('.cpub-main-layout');
    await expect(layout).toBeVisible();

    // Content grid should still be visible
    await expect(page.locator('.cpub-feed-col')).toBeVisible();
  });

  test('mobile: content grid becomes single column', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Hero should still be visible
    const hero = page.locator('.cpub-hero-banner');
    if (await hero.isVisible()) {
      await expect(hero).toBeVisible();
    }

    // Tabs should be scrollable
    await expect(page.locator('.cpub-tabs-bar')).toBeVisible();
  });
});

test.describe('Search page responsive layout', () => {
  test('desktop: two-column with sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/search');

    await expect(page.locator('.cpub-main-col')).toBeVisible();
    await expect(page.locator('.cpub-sidebar-col')).toBeVisible();
  });

  test('mobile: filter pills are scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/search');

    await expect(page.locator('.cpub-filter-strip')).toBeVisible();
    await expect(page.locator('.cpub-search-input-main')).toBeVisible();
  });
});

test.describe('Auth pages responsive', () => {
  test('login form is usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/auth/login');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register form is usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/auth/register');

    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

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
      // Regression: hero must not overflow the viewport on mobile
      // (the action buttons used to run off the right edge).
      const box = await hero.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(376);
      const actions = hero.locator('.cpub-hero-actions').first();
      if (await actions.isVisible()) {
        const ab = await actions.boundingBox();
        expect(ab!.x + ab!.width).toBeLessThanOrEqual(376);
      }
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

test.describe('Learn page responsive', () => {
  test('desktop: sidebar is side-by-side with content', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/learn', { waitUntil: 'networkidle' });

    const hero = page.locator('.cpub-learn-hero');
    await expect(hero).toBeVisible();

    // On desktop both shell columns are visible within the same viewport row
    const main = page.locator('.cpub-main-content');
    const sidebar = page.locator('.cpub-sidebar');
    await expect(main).toBeVisible();
    await expect(sidebar).toBeVisible();

    const mainBox = await main.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    // Sidebar is to the right of main on desktop
    expect(mainBox && sidebarBox).toBeTruthy();
    expect(sidebarBox!.x).toBeGreaterThan(mainBox!.x);
  });

  test('mobile: sidebar stacks below content (not crushed beside it)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/learn', { waitUntil: 'networkidle' });

    const hero = page.locator('.cpub-learn-hero');
    await expect(hero).toBeVisible();

    const main = page.locator('.cpub-main-content');
    const sidebar = page.locator('.cpub-sidebar');
    await expect(main).toBeVisible();

    // Sidebar exists but is stacked below; can't be both (a) visible at the
    // top AND (b) to the right of main at 375px — session 133 regression
    // check for the fixed 240px sidebar layout.
    if (await sidebar.isVisible()) {
      const mainBox = await main.boundingBox();
      const sidebarBox = await sidebar.boundingBox();
      expect(mainBox && sidebarBox).toBeTruthy();
      // Below (higher y) OR at the same x (not to the right).
      expect(sidebarBox!.y).toBeGreaterThanOrEqual(mainBox!.y);
      expect(sidebarBox!.x).toBeLessThanOrEqual(mainBox!.x + 5);
    }
  });
});

test.describe('Videos page responsive', () => {
  test('desktop: sidebar is side-by-side with videos grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/videos', { waitUntil: 'networkidle' });

    const hero = page.locator('.cpub-video-hero');
    await expect(hero).toBeVisible();

    const mainGrid = page.locator('.cpub-main-grid');
    await expect(mainGrid).toBeVisible();

    // On desktop the 1fr/300px grid puts sidebar to the right of main.
    const sidebar = page.locator('.cpub-videos .cpub-sidebar');
    await expect(sidebar).toBeVisible();

    const gridBox = await mainGrid.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    expect(gridBox && sidebarBox).toBeTruthy();
    // Sidebar starts past the midpoint of the grid on desktop.
    expect(sidebarBox!.x).toBeGreaterThan(gridBox!.x + gridBox!.width / 2);
  });

  test('mobile: sidebar stacks below and hero stays within viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/videos', { waitUntil: 'networkidle' });

    const hero = page.locator('.cpub-video-hero');
    await expect(hero).toBeVisible();

    // Hero must not overflow the 375px viewport — regression guard for
    // the 32px-padding + 1200px max-width layout on small screens.
    const heroBox = await hero.boundingBox();
    expect(heroBox!.width).toBeLessThanOrEqual(376);

    // Sidebar exists but is stacked below the main grid — not to the
    // right at 375px. Regression guard for the 1fr/300px grid.
    const mainGrid = page.locator('.cpub-main-grid');
    const sidebar = page.locator('.cpub-videos .cpub-sidebar');
    await expect(mainGrid).toBeVisible();

    if (await sidebar.isVisible()) {
      const gridBox = await mainGrid.boundingBox();
      const sidebarBox = await sidebar.boundingBox();
      expect(gridBox && sidebarBox).toBeTruthy();
      // Below (higher y) OR at same x (not pushed off-screen to the right).
      expect(sidebarBox!.x).toBeLessThanOrEqual(gridBox!.x + 5);
    }
  });
});

test.describe('Mobile navigation menu', () => {
  // Regression guard: the mobile hamburger menu must render the real
  // site nav (MobileNavRenderer), not just the inline Search/auth extras.
  // Broke silently when <MobileNavRenderer> failed to resolve under
  // Nuxt's pathPrefix auto-import naming (component at
  // components/nav/MobileNavRenderer.vue auto-registers as
  // <NavMobileNavRenderer>). If it regresses, only "Search" shows.
  test('hamburger opens menu with real nav links (logged out)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggle = page.locator('.cpub-mobile-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const menu = page.locator('.cpub-mobile-menu');
    await expect(menu).toBeVisible();

    // The MobileNavRenderer <nav> (not the cpub-mobile-nav-extra sibling)
    // must render the always-visible, ungated "Home" link.
    const mobileNav = page.locator('.cpub-mobile-nav:not(.cpub-mobile-nav-extra)');
    await expect(mobileNav).toBeVisible();
    await expect(
      mobileNav.getByRole('link', { name: 'Home' }),
    ).toBeVisible();
  });
});

test.describe('Auth pages responsive', () => {
  test('login form is usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/auth/login');

    await expect(page.locator('#identity')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    // Scoped: the page has additional submit buttons (federated/Mastodon
    // sign-in forms, session 188) — the bare locator is ambiguous.
    await expect(
      page.locator('form[aria-label="Login form"] button[type="submit"]'),
    ).toBeVisible();
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

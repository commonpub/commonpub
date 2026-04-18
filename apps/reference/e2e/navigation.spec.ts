import { test, expect } from '@playwright/test';

/**
 * Navigation tests — verify client-side routing, link integrity, and tab interactions.
 */

test.describe('Homepage tab switching', () => {
  test('clicking tabs updates active state', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const tabs = page.locator('.cpub-tab');
    await tabs.first().waitFor({ state: 'visible', timeout: 15000 });

    // Default active tab depends on auth state — find whichever tab starts active
    const initialActive = page.locator('.cpub-tab.active');
    await initialActive.waitFor({ state: 'visible', timeout: 10000 });
    const activeIndex = await tabs.evaluateAll((els) =>
      els.findIndex((el) => el.classList.contains('active')),
    );

    // Click a different tab and verify active state switches
    const otherIndex = activeIndex === 0 ? 1 : 0;
    const otherTab = tabs.nth(otherIndex);
    await otherTab.click();
    await expect(otherTab).toHaveClass(/active/, { timeout: 10000 });
    await expect(tabs.nth(activeIndex)).not.toHaveClass(/active/, { timeout: 10000 });
  });

  test('hero banner dismiss button works', async ({ page }) => {
    await page.goto('/');

    const banner = page.locator('.cpub-hero-banner');
    await expect(banner).toBeVisible({ timeout: 5000 });

    const dismissBtn = page.locator('.cpub-hero-dismiss');
    await dismissBtn.waitFor({ state: 'visible' });
    await dismissBtn.click();
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
    await expect(footer.locator('a[href="/feed.xml"]').first()).toBeVisible();
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
    await page.goto('/search', { waitUntil: 'networkidle' });

    const pills = page.locator('.cpub-type-pill');
    await pills.first().waitFor({ state: 'visible', timeout: 10000 });

    const allPill = pills.first();
    const projectsPill = pills.nth(1);

    await expect(allPill).toHaveClass(/active/, { timeout: 10000 });

    await projectsPill.click();
    // Wait for Vue reactivity to update the class
    await expect(projectsPill).toHaveClass(/active/, { timeout: 10000 });
    await expect(allPill).not.toHaveClass(/active/, { timeout: 5000 });
  });

  test('advanced filters panel toggles', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'networkidle' });

    const filterBtn = page.locator('.cpub-adv-filter-btn');
    await filterBtn.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for Vue hydration: the button's reactive `{ open: advOpen }`
    // class binding needs to be wired up before the click fires, else
    // the click event fires into a de-hydrated listener and advOpen
    // stays false. Use the button's enabled state as a hydration beacon.
    await expect(filterBtn).toBeEnabled();

    const panel = page.locator('.cpub-adv-panel');
    await expect(panel).not.toBeVisible();

    await filterBtn.click();
    // Confirm the click landed by waiting for the button's `open` class
    // — this flips with `advOpen` and guards against a false-positive
    // "panel not found yet" timeout when Vue is still hydrating.
    await expect(filterBtn).toHaveClass(/open/, { timeout: 5000 });
    await expect(panel).toBeVisible();

    await filterBtn.click();
    await expect(filterBtn).not.toHaveClass(/open/, { timeout: 5000 });
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

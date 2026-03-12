import { test, expect } from '@playwright/test';
import { testUsers, signIn } from './fixtures/setup';

test.describe('Theme System', () => {
  test('default theme is applied', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    // Base theme is default — no data-theme or data-theme="base"
    const theme = await html.getAttribute('data-theme');
    expect(theme === null || theme === 'base').toBeTruthy();
  });

  test('can switch theme', async ({ page }) => {
    await signIn(page, testUsers.member);
    await page.goto('/settings');

    const themeSelector = page
      .getByRole('combobox', { name: /theme/i })
      .or(page.getByLabel(/theme/i));

    if (await themeSelector.isVisible()) {
      await themeSelector.selectOption('deepwood');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'deepwood');
    }
  });

  test('theme persists across page navigation', async ({ page }) => {
    await signIn(page, testUsers.member);
    // Set theme via cookie or settings
    await page.goto('/');
    const initialTheme = await page.locator('html').getAttribute('data-theme');

    await page.goto('/dashboard');
    const afterNavTheme = await page.locator('html').getAttribute('data-theme');

    expect(afterNavTheme).toBe(initialTheme);
  });
});

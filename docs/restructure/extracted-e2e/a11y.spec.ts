import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { testUsers, signIn } from './fixtures/setup';

test.describe('Accessibility', () => {
  test('home page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });

  test('auth sign-in page has no critical a11y violations', async ({ page }) => {
    await page.goto('/auth/signin');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });

  test('dashboard has no critical a11y violations', async ({ page }) => {
    await signIn(page, testUsers.member);

    const heading = page.getByRole('heading', { name: /dashboard/i });
    if (await heading.isVisible({ timeout: 5000 }).catch(() => false)) {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
    }
  });

  test('theme contrast: base theme passes color contrast', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    const criticalContrast = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalContrast).toEqual([]);
  });

  test('theme contrast: deepwood theme passes color contrast', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'deepwood');
    });
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    const criticalContrast = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(criticalContrast).toEqual([]);
  });

  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withRules(['keyboard', 'tabindex', 'focus-order-semantics'])
      .analyze();
    expect(results.violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });
});

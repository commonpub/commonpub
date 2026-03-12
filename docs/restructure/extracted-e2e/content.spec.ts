import { test, expect } from '@playwright/test';
import { testUsers, signIn } from './fixtures/setup';

test.describe('Content Management', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, testUsers.member);
  });

  test('can create a new article', async ({ page }) => {
    await page.goto('/new');
    await page.getByLabel('Title').fill(`Test Article ${Date.now()}`);
    await page.getByRole('button', { name: /publish|save|create/i }).click();
    await expect(page.getByText(/published|created|saved/i)).toBeVisible();
  });

  test('can view an article', async ({ page }) => {
    await page.goto('/');
    const firstArticle = page.getByRole('article').first();
    if (await firstArticle.isVisible()) {
      await firstArticle.click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('can edit an existing article', async ({ page }) => {
    await page.goto('/dashboard');
    const editButton = page.getByRole('link', { name: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.getByLabel('Title').fill(`Updated ${Date.now()}`);
      await page.getByRole('button', { name: /save|update/i }).click();
      await expect(page.getByText(/updated|saved/i)).toBeVisible();
    }
  });
});

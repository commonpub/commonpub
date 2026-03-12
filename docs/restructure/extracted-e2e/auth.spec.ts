import { test, expect } from '@playwright/test';
import { testUsers, signUp, signIn, signOut } from './fixtures/setup';

test.describe('Authentication', () => {
  test('can sign up with email and password', async ({ page }) => {
    const uniqueUser = {
      ...testUsers.member,
      email: `test-${Date.now()}@test.commonpub.dev`,
    };
    await signUp(page, uniqueUser);
    await expect(page).toHaveURL(/\/(dashboard|$)/);
  });

  test('can sign in with existing account', async ({ page }) => {
    await signIn(page, testUsers.member);
    await expect(page).toHaveURL(/\/(dashboard|$)/);
  });

  test('can sign out', async ({ page }) => {
    await signIn(page, testUsers.member);
    await signOut(page);
    await expect(page).toHaveURL('/');
  });
});

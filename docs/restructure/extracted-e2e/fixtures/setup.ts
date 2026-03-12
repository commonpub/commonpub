import type { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export const testUsers = {
  member: {
    email: 'member@test.commonpub.dev',
    password: 'Test1234!Member',
    name: 'Test Member',
  },
  staff: {
    email: 'staff@test.commonpub.dev',
    password: 'Test1234!Staff',
    name: 'Test Staff',
  },
  admin: {
    email: 'admin@test.commonpub.dev',
    password: 'Test1234!Admin',
    name: 'Test Admin',
  },
} as const;

export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/signup');
  await page.getByLabel('Name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign up/i }).click();
  await page.waitForURL(/\/(dashboard|$)/);
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/signin');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|$)/);
}

export async function signOut(page: Page): Promise<void> {
  await page.goto('/auth/signout');
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL('/');
}

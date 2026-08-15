import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { dismissCookieBanner } from './consent';

/**
 * Real accounts for specs that need a logged-in member.
 *
 * Extracted from `contest-lifecycle.spec.ts`, which grew this recipe first and
 * still carries its own copy. There is exactly one way to get a session in this
 * app and it is the one below: sign up through better-auth and keep the browser
 * context it hands back. A forged cookie does NOT work, because better-auth
 * signs the session token, so a seeded value fails verification and every
 * request comes back unauthenticated with no clue why.
 *
 * `apps/reference/scripts/seed.ts` writes users with no credential rows, so a
 * seeded account cannot log in either. Signing up is the only door.
 *
 * TEARDOWN: closing the context is all a spec has to do. The accounts stay in
 * the database, exactly as `contest-lifecycle.spec.ts` leaves its four, and a
 * second run cannot collide with them because `RUN` below makes every username
 * and address unique. Deleting them would be a heavier operation than a
 * teardown deserves: account deletion soft-deletes and cascades, so a failed
 * teardown would silently change what the NEXT run's queries can see.
 */

/**
 * One suffix per spec FILE process, not per call.
 *
 * `playwright.config.ts` sets `fullyParallel: true`, so two spec files run at
 * once and a bare `Date.now()` can collide on the unique `users.username`
 * index. The random tail is what keeps a second, concurrent run of the same
 * spec from taking the first one's usernames.
 */
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The password every e2e account uses. Meets the auth minimum, nothing more. */
export const E2E_PASSWORD = 'Password123!';

/**
 * A username that is unique to this run and legal for `usernameSchema`
 * (`^[a-zA-Z0-9_-]+$`, 3 to 64 characters).
 */
export function uniqueHandle(prefix: string): string {
  return `${prefix}${RUN}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
}

export interface E2EAccount {
  username: string;
  email: string;
  password: string;
  /** Carries the session cookie. Use `ctx.request` for API calls AS this user. */
  ctx: BrowserContext;
  page: Page;
  close(): Promise<void>;
}

/**
 * Sign up a fresh member and hand back their context and a page.
 *
 * The `origin` header is deliberate, not decoration: better-auth runs its CSRF
 * origin check only when the request carries a Cookie header, and
 * `dismissCookieBanner` gives this context one. A real browser always sends
 * Origin, so sending it makes the call more realistic rather than less.
 */
export async function signUp(
  browser: Browser,
  baseUrl: string,
  prefix: string,
): Promise<E2EAccount> {
  const ctx = await browser.newContext();
  // Answer the cookie banner up front. With analytics configured it is fixed to
  // the bottom of every page at a high z-index and intercepts clicks on
  // whatever is under it, so without this a spec quietly tests the banner.
  await dismissCookieBanner(ctx, baseUrl);

  const username = uniqueHandle(prefix);
  const email = `${username}@example.com`;
  const res = await ctx.request.post(`${baseUrl}/api/auth/sign-up/email`, {
    headers: { origin: baseUrl },
    data: { email, password: E2E_PASSWORD, username, name: prefix },
  });
  expect(res.ok(), `sign-up ${username}: ${res.status()} ${await res.text()}`).toBeTruthy();

  return {
    username,
    email,
    password: E2E_PASSWORD,
    ctx,
    page: await ctx.newPage(),
    close: () => ctx.close(),
  };
}

/**
 * Log an EXISTING account in, for credentials supplied from outside the run
 * (an operator's admin account, say). Returns null when the sign-in is
 * refused, so a caller can skip with a precise message instead of failing on a
 * setup step that was never the thing under test.
 */
export async function signIn(
  browser: Browser,
  baseUrl: string,
  email: string,
  password: string,
): Promise<E2EAccount | null> {
  const ctx = await browser.newContext();
  await dismissCookieBanner(ctx, baseUrl);
  const res = await ctx.request.post(`${baseUrl}/api/auth/sign-in/email`, {
    headers: { origin: baseUrl },
    data: { email, password },
  });
  if (!res.ok()) {
    await ctx.close();
    return null;
  }
  return {
    username: email,
    email,
    password,
    ctx,
    page: await ctx.newPage(),
    close: () => ctx.close(),
  };
}

/**
 * The instance's live feature flags.
 *
 * `GET /api/features` returns `config.features` directly today; the `?? body`
 * fallback matches `analytics-consent.spec.ts` so a later envelope does not
 * turn every flag into `undefined` (which reads as "off" and would make a whole
 * spec skip while looking green).
 */
export async function readFeatures(
  ctx: Pick<BrowserContext, 'request'>,
  baseUrl: string,
): Promise<Record<string, boolean>> {
  const res = await ctx.request.get(`${baseUrl}/api/features`);
  expect(res.ok(), `GET /api/features: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as Record<string, unknown>;
  const flags = (body.features ?? body) as Record<string, boolean>;
  return flags;
}

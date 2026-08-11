import type { BrowserContext } from '@playwright/test';

/**
 * Pre-answer the cookie banner for a browser context.
 *
 * The consent banner is `position: fixed; bottom: 0` at a high z-index, so on an
 * instance with analytics configured it covers the bottom of every page until
 * the visitor answers it, and Playwright clicks on anything underneath are
 * intercepted. A spec that is testing contest registration should not silently
 * be testing the consent banner instead.
 *
 * `essential` rather than `all`: it dismisses the banner without opting the test
 * run into loading a third-party tag. The gate itself is covered deliberately,
 * and without this helper, in analytics-consent.spec.ts.
 */
export async function dismissCookieBanner(ctx: BrowserContext, baseUrl: string): Promise<void> {
  const { hostname } = new URL(baseUrl);
  await ctx.addCookies([
    { name: 'cpub-consent', value: 'essential', domain: hostname, path: '/' },
  ]);
}

import { test, expect } from '@playwright/test';

/**
 * The consent gate, tested by watching the network rather than the code.
 *
 * This is the one property that matters and the one a unit test cannot really
 * prove: no request reaches the analytics vendor until the visitor says yes.
 * Everything else about the feature (which cookies, which CSP origins) is
 * derived from one registry and unit-tested there.
 *
 * Requires FEATURE_ANALYTICS=true; the reference app declares a provider but
 * leaves the flag off, so without it the banner never appears and these skip.
 */
const BASE = 'http://localhost:3000';

// This is the one spec that must meet the banner un-answered: the shared
// storageState in playwright.config pre-dismisses it for every other spec.
test.use({ storageState: { cookies: [], origins: [] } });
const isTagRequest = (url: string): boolean => /googletagmanager|google-analytics/i.test(url);

test.describe('analytics consent gate', () => {
  test.skip(process.env.FEATURE_ANALYTICS !== 'true', 'analytics flag is off');

  test('loads nothing before the visitor chooses, and nothing at all if they refuse', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => { if (isTagRequest(r.url())) hits.push(r.url()); });

    await page.goto(BASE);
    await expect(page.getByRole('dialog', { name: /cookie consent/i })).toBeVisible();
    expect(hits, 'nothing may load before a choice is made').toEqual([]);

    // Refusing must be as easy as accepting, and must actually mean no.
    await page.getByRole('button', { name: /essential only/i }).click();
    await page.waitForTimeout(1000);
    await page.goto(`${BASE}/contests`);
    await page.waitForTimeout(1500);
    expect(hits, 'refusing means no tag, across navigation too').toEqual([]);
  });

  test('loads only after the visitor accepts, and remembers the choice', async ({ page, context }) => {
    const hits: string[] = [];
    page.on('request', (r) => { if (isTagRequest(r.url())) hits.push(r.url()); });

    await page.goto(BASE);
    await page.getByRole('button', { name: /accept all/i }).click();
    await page.waitForTimeout(2000);
    expect(hits.length, 'the tag loads once consent is given').toBeGreaterThan(0);

    const consent = (await context.cookies()).find((c) => c.name === 'cpub-consent');
    expect(consent?.value).toBe('all');

    // The banner does not come back on the next page load.
    await page.goto(`${BASE}/contests`);
    await page.waitForTimeout(1000);
    await expect(page.getByRole('dialog', { name: /cookie consent/i })).toBeHidden();
  });

  test('the banner names what it is asking about, and both choices are equal', async ({ page }) => {
    await page.goto(BASE);
    const banner = page.getByRole('dialog', { name: /cookie consent/i });
    await expect(banner).toContainText(/analytics/i);

    // Consent is only freely given if refusing is as easy as accepting. Same
    // element type, same size class, no filled-vs-outlined asymmetry.
    const accept = banner.getByRole('button', { name: /accept all/i });
    const refuse = banner.getByRole('button', { name: /essential only/i });
    const [a, r] = [await accept.boundingBox(), await refuse.boundingBox()];
    expect(a).not.toBeNull();
    expect(r).not.toBeNull();
    expect(Math.abs(a!.height - r!.height), 'the two choices must look equally available').toBeLessThanOrEqual(2);
    expect(Math.abs(a!.width - r!.width)).toBeLessThanOrEqual(2);
  });

  test('the cookie policy lists the provider cookies without the operator declaring them', async ({ page }) => {
    await page.goto(`${BASE}/cookies`);
    await expect(page.locator('body')).toContainText('_ga');
  });
});

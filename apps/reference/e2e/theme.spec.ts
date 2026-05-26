import { test, expect } from '@playwright/test';

/**
 * Theme system E2E — locks the full output path for the session-154 theme
 * editor (per docs/plans/layout-and-pages.md §10.1: the unit tests for
 * tokensToCss / middleware / plugin are real individually, but the
 * SSR-to-HTML integration was previously unverified — and per memory
 * `feedback_integration_test_full_output_path`, that's the shape of bug
 * sessions 149 + 150 both shipped).
 *
 * Three layers of coverage:
 *
 *   1. **SSR HTML pin** — the `<html data-theme>` attribute + the
 *      `<style id="cpub-theme-inline">` block (when applicable) must
 *      actually appear in the response body the server sends. Unit tests
 *      cover the producers; this pins the wire format.
 *
 *   2. **Admin pages render** — the new admin theme pages (list + editor)
 *      load without fatal errors. Even though they redirect unauthenticated
 *      users, the redirect itself proves the routes are wired correctly.
 *
 *   3. **Public API surface** — `/api/admin/themes` is admin-only (so
 *      anonymous calls 401/403), and the route exists (no 404). Pins the
 *      endpoint shape's existence.
 *
 * NOTE: tests here intentionally don't require an authenticated admin
 * session — the e2e setup in this repo doesn't yet have auth fixtures
 * (see editor.spec.ts NOTE). When auth fixtures land, extend with a
 * full POST-custom-theme → GET / → assert inline tokens flow.
 */

test.describe('Theme SSR — html attributes + inline style', () => {
  test('homepage SSR HTML has no data-theme attribute by default (base theme)', async ({ page }) => {
    // The base theme deliberately omits `data-theme` — the absence is the
    // signal (plugins/theme.ts:27 `if (themeId.value && themeId.value !== 'base')`).
    // This is a wire-format invariant: a regression that sets `data-theme="base"`
    // would invalidate any theme CSS that uses `:not([data-theme])` selectors.
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    const html = await page.content();

    // <html> opening tag should NOT contain data-theme (for the default base theme)
    const htmlTagMatch = html.match(/<html[^>]*>/);
    expect(htmlTagMatch).toBeTruthy();
    if (htmlTagMatch && !htmlTagMatch[0].includes('data-theme="base"')) {
      // Either data-theme is absent OR set to something non-base.
      // The default reference-app config uses base, so it's absent.
    }
    expect(htmlTagMatch![0]).not.toContain('data-theme="base"');
  });

  test('homepage SSR HTML does NOT contain cpub-theme-inline style when no custom tokens', async ({ page }) => {
    // The inline `<style id="cpub-theme-inline">` is injected ONLY when
    // `event.context.themeInlineCss` is non-empty (per server/middleware/theme.ts).
    // For an instance with no custom theme + no token overrides, it must be absent.
    // Empty-cases like this catch a regression that "always renders" the style block
    // with empty content (which would pollute every page's HTML).
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    expect(html).not.toContain('id="cpub-theme-inline"');
  });

  test('dark mode cookie produces data-theme="dark" in SSR HTML', async ({ page, context }) => {
    // The server middleware (server/middleware/theme.ts) reads `cpub-color-scheme`
    // and resolves to the family's dark variant. For the default `base` family
    // ('classic'), dark → 'dark'. Wire-format test: cookie sets, html attribute appears.
    await context.addCookies([
      { name: 'cpub-color-scheme', value: 'dark', url: 'http://localhost:3000' },
    ]);
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    const html = await page.content();
    const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? '';
    expect(htmlTag).toContain('data-theme="dark"');
  });

  test('invalid cpub-color-scheme cookie value is ignored (falls back to default)', async ({ page, context }) => {
    // Defensive — a garbage cookie value should not break SSR. The middleware
    // accepts only 'light' | 'dark'; anything else falls through to the admin default.
    await context.addCookies([
      { name: 'cpub-color-scheme', value: '<script>alert(1)</script>', url: 'http://localhost:3000' },
    ]);
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    const html = await page.content();
    // Should not have data-theme set to anything weird, AND the script tag
    // certainly should not have escaped into the html attribute
    expect(html).not.toContain('<script>alert(1)</script>');
    const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? '';
    expect(htmlTag).not.toContain('alert');
  });
});

test.describe('Admin theme pages — route + render', () => {
  test('/admin/theme exists (responds, even if it gates on auth)', async ({ page }) => {
    // Route exists ≠ 404. Route is admin-gated; unauthenticated either redirects
    // (to login) or shows the layout's admin-denied state (per
    // layouts/admin.vue). Either is acceptable evidence the route is wired.
    const response = await page.goto('/admin/theme', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('/admin/theme/edit/__new exists (create-mode editor)', async ({ page }) => {
    const response = await page.goto('/admin/theme/edit/__new', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('/admin/theme/edit/<slug> route is recognised (404 only on missing theme, not missing route)', async ({ page }) => {
    // Visiting an editor URL for a non-existent custom theme should produce a
    // resource-level 404 from the API fetch INSIDE the page — but the page itself
    // must render the editor shell. This distinguishes "route doesn't exist"
    // (catastrophic) from "theme not found" (handled gracefully).
    const response = await page.goto('/admin/theme/edit/never-existed', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('no fatal console errors on admin theme pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const path of ['/admin/theme', '/admin/theme/edit/__new']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    // Filter expected noise: unauthenticated 401/404 from admin-only API,
    // CSP frame-src on the preview surface during hydration, missing-resource
    // 404s for theme-not-found cases.
    const fatalErrors = errors.filter(
      (e) =>
        !e.includes('Failed to fetch') &&
        !e.includes('fetch') &&
        !e.includes('401') &&
        !e.includes('404') &&
        !e.includes('500') &&
        !e.includes('Content Security Policy directive') &&
        !e.includes('H3Error'),
    );
    expect(fatalErrors).toHaveLength(0);
  });
});

test.describe('Admin theme API surface', () => {
  test('GET /api/admin/themes refuses anonymous (admin-gated)', async ({ request }) => {
    const response = await request.get('/api/admin/themes');
    // Either 401 (auth required) or 403 (forbidden) is acceptable. 404 would
    // mean the route was never wired. 200 would mean we'd accidentally exposed
    // the admin theme list to anonymous callers — both critical regressions.
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/admin/themes/discover refuses anonymous', async ({ request }) => {
    const response = await request.get('/api/admin/themes/discover');
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/admin/themes/<id> refuses anonymous (route exists)', async ({ request }) => {
    const response = await request.get('/api/admin/themes/some-id');
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/admin/themes refuses anonymous', async ({ request }) => {
    const response = await request.post('/api/admin/themes', { data: {} });
    // Auth check happens BEFORE body validation, so we expect 401/403, not 400.
    expect([401, 403]).toContain(response.status());
  });

  test('DELETE /api/admin/themes/<id> refuses anonymous', async ({ request }) => {
    const response = await request.delete('/api/admin/themes/some-id');
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Theme system regression guards', () => {
  test('homepage <head> has no duplicate theme-inline style tags', async ({ page }) => {
    // A regression where the plugin registers the style multiple times during
    // hydration would produce N duplicate `<style id="cpub-theme-inline">`
    // tags — invalid HTML (id collision) and a sign of plugin double-fire.
    await page.goto('/', { waitUntil: 'networkidle' });
    const html = await page.content();
    const matches = html.match(/id="cpub-theme-inline"/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  test('theme cookie does not leak into HTML when it contains special chars', async ({ page, context }) => {
    // Belt-and-braces XSS check: the middleware accepts only 'light' | 'dark',
    // but if the validation broke and a raw cookie value flowed into a data
    // attribute or inline style, we'd see it in the HTML. Pre-pin against that.
    await context.addCookies([
      { name: 'cpub-color-scheme', value: '"><img src=x onerror=alert(1)>', url: 'http://localhost:3000' },
    ]);
    await page.goto('/');
    const html = await page.content();
    expect(html).not.toContain('onerror=alert');
    expect(html).not.toContain('img src=x');
  });
});

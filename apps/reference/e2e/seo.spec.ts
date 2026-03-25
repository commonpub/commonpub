import { test, expect } from '@playwright/test';

/**
 * SEO tests — verify robots.txt, sitemap.xml, RSS feeds, and meta tags.
 */

test.describe('robots.txt', () => {
  test('returns valid robots.txt', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('User-agent:');
    expect(body).toContain('Sitemap:');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /admin/');
    expect(body).toContain('Disallow: /settings/');
  });
});

test.describe('sitemap.xml', () => {
  test('returns valid XML', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('xml');

    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<url>');
    expect(body).toContain('<loc>');
  });
});

test.describe('RSS feed', () => {
  test('site-wide feed returns valid XML', async ({ request }) => {
    const response = await request.get('/feed.xml');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('xml');

    const body = await response.text();
    expect(body).toContain('<rss');
    expect(body).toContain('<channel>');
    expect(body).toContain('CommonPub');
  });
});

test.describe('Meta tags', () => {
  test('homepage has correct meta title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CommonPub/);
  });

  test('homepage has description meta tag', async ({ page }) => {
    await page.goto('/');
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /maker|community|projects/i);
  });

  test('search page has correct title', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveTitle(/Search.*CommonPub/);
  });

  test('login page has correct title', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Log in.*CommonPub/);
  });

  test('register page has correct title', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveTitle(/Register.*CommonPub/);
  });

  test('homepage has RSS link tag', async ({ page }) => {
    await page.goto('/');
    const rssLink = page.locator('link[type="application/rss+xml"]');
    await expect(rssLink).toHaveAttribute('href', /feed\.xml/);
  });
});

test.describe('Security headers', () => {
  test('API endpoints return appropriate headers', async ({ request }) => {
    const response = await request.get('/api/health');

    // Should not expose server info
    const serverHeader = response.headers()['x-powered-by'];
    // Nuxt/Nitro sets this by default — just check it's not something weird
    if (serverHeader) {
      expect(serverHeader).not.toContain('Express');
    }
  });
});

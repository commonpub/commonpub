import { test, expect } from '@playwright/test';

/**
 * The tags that decide how a page is indexed and how a shared link renders.
 *
 * These are asserted against the SERVED HTML rather than the DOM, because that
 * is all a crawler or an unfurler ever sees: Slack, Discord, iMessage and
 * Googlebot do not run the client bundle, so a tag added after hydration does
 * not exist for them.
 *
 * Session 254 shipped these after finding, on the live deveco.io, that content
 * pages carried no canonical at all and contest pages had no description, no
 * og:description and og:type "website".
 */
const BASE = 'http://localhost:3000';

/** Attribute value of a meta/link tag, straight out of the response body. */
function tag(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1] ?? null;
}
const ogTag = (html: string, prop: string): string | null =>
  tag(html, new RegExp(`<meta[^>]+property="og:${prop}"[^>]+content="([^"]*)"`))
  ?? tag(html, new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="og:${prop}"`));
const canonicalOf = (html: string): string | null =>
  tag(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/)
  ?? tag(html, /<link[^>]+href="([^"]*)"[^>]+rel="canonical"/);

test.describe('SEO tags in the served HTML', () => {
  test('every page carries a self-referential canonical', async ({ request }) => {
    for (const path of ['/', '/explore', '/contests', '/privacy']) {
      const html = await (await request.get(`${BASE}${path}`)).text();
      const canonical = canonicalOf(html);
      expect(canonical, `${path} must declare a canonical`).toBeTruthy();
      expect(canonical, `${path} canonical must be absolute`).toMatch(/^https?:\/\//);
      expect(
        new URL(canonical!).pathname,
        `${path} must canonicalise to itself, not elsewhere`,
      ).toBe(path);
    }
  });

  test('the canonical drops the query string', async ({ request }) => {
    // The reason canonical exists: `?utm_source=`, `?page=`, `?sort=` and a
    // shared link with a tracking parameter are one document, and each variant
    // left alone becomes a competing URL in the index.
    const html = await (await request.get(`${BASE}/explore?sort=recent&utm_source=newsletter`)).text();
    const canonical = canonicalOf(html);
    expect(canonical).toBeTruthy();
    expect(canonical, 'query parameters must not reach the canonical').not.toContain('utm_source');
    expect(new URL(canonical!).search).toBe('');
    expect(new URL(canonical!).pathname).toBe('/explore');
  });

  test('the canonical points at this instance, never a hardcoded host', async ({ request }) => {
    // A canonical aimed at the wrong host delists the instance entirely, which
    // is strictly worse than having none.
    const html = await (await request.get(`${BASE}/explore`)).text();
    const canonical = canonicalOf(html);
    expect(new URL(canonical!).origin).toBe(new URL(BASE).origin);
    expect(canonical).not.toContain('commonpub.io');
  });

  test('og:url agrees with the canonical', async ({ request }) => {
    const html = await (await request.get(`${BASE}/contests`)).text();
    expect(ogTag(html, 'url')).toBe(canonicalOf(html));
  });

  test('a contest page describes itself for search and for unfurls', async ({ request }) => {
    const list = await (await request.get(`${BASE}/api/contests?limit=1`)).json();
    const slug = list.items?.[0]?.slug;
    test.skip(!slug, 'no contest seeded');

    const detail = await (await request.get(`${BASE}/api/contests/${slug}`)).json();
    const contest = detail.contest ?? detail;
    const html = await (await request.get(`${BASE}/contests/${slug}`)).text();

    expect(ogTag(html, 'type'), 'a contest is not a "website"').toBe('article');

    // An EMPTY description tag is worse than none: it positively tells a
    // crawler the page has no description instead of letting it fall back to
    // the content. Seed data varies, so this holds either way.
    expect(html, 'never emit an empty description').not.toMatch(/<meta name="description" content>/);

    const hasSource = Boolean(contest.subheading?.trim() || contest.description);
    if (!hasSource) {
      expect(
        tag(html, /<meta[^>]+name="description"[^>]+content="([^"]+)"/),
        'nothing to describe, so nothing should be claimed',
      ).toBeNull();
      return;
    }

    const description = tag(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/);
    expect(description, 'a contest with a body must describe itself').toBeTruthy();
    expect(ogTag(html, 'description'), 'og:description is what Slack and Discord render').toBeTruthy();
    // Raw Markdown must not leak into a meta tag. The description field can
    // open with an HTML comment, which is why the excerpt helper is used.
    expect(description, 'the excerpt must be plain text').not.toContain('<!--');
    expect(description).not.toMatch(/^\s*[#*|]/);
  });

  test('a listing page stays og:type website', async ({ request }) => {
    // The article override must not leak onto pages that are not articles.
    const html = await (await request.get(`${BASE}/contests`)).text();
    expect(ogTag(html, 'type')).toBe('website');
  });

  test('og:site_name is the instance brand, on every page', async ({ request }) => {
    for (const path of ['/', '/contests', '/privacy']) {
      const html = await (await request.get(`${BASE}${path}`)).text();
      const name = ogTag(html, 'site_name');
      expect(name, `${path} must name the instance`).toBeTruthy();
      expect(name).not.toBe('');
    }
  });
});

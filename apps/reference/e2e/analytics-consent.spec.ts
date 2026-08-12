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

/**
 * Everything the loader has handed to gtag on this page, serialised.
 *
 * This is the honest oracle for "what does the provider learn". A beacon may
 * not have flushed yet, and on a property that does not exist it may never
 * flush at all, so a network-only assertion can pass while the code is wrong.
 * The dataLayer is what our code decided to say, which is the thing under test.
 */
async function tagCommands(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
    return dl
      .map((entry) => {
        try {
          return JSON.stringify(Array.from(entry as ArrayLike<unknown>));
        } catch {
          return '';
        }
      })
      .filter(Boolean);
  });
}

test.describe('analytics consent gate', () => {
  test.skip(process.env.FEATURE_ANALYTICS !== 'true', 'analytics flag is off');

  test('loads nothing before the visitor chooses, and nothing at all if they refuse', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => { if (isTagRequest(r.url())) hits.push(r.url()); });

    await page.goto(BASE);
    // The banner is mounted by a client-only plugin, so it appears after
    // hydration rather than in the SSR markup. On a loaded CI runner that can
    // exceed the default 5s expect timeout, which made this spec flaky without
    // anything being wrong.
    await expect(page.getByRole('dialog', { name: /cookie consent/i })).toBeVisible({ timeout: 15_000 });
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
    // `all|<scope>`, url-encoded in transit. The scope records WHAT was being
    // asked about, so the answer cannot later be reused for something else.
    expect(consent?.value).toMatch(/^all(%7C|\|)\w+$/);

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

  /**
   * A consent cookie from BEFORE analytics existed must not authorise it.
   *
   * Between 2026-04-04 and 2026-06-10 the only non-essential cookie was a
   * dark-mode preference, so "Accept all" meant "remember my theme". Those
   * cookies last a year. Session 254 confirmed against the live deveco.io
   * property that a bare `cpub-consent=all` loaded the tag, set both `_ga`
   * cookies and sent a beacon, with no banner shown.
   */
  test('a consent cookie from before analytics existed grants nothing and asks again', async ({ page, context }) => {
    const hits: string[] = [];
    page.on('request', (r) => { if (isTagRequest(r.url())) hits.push(r.url()); });

    await context.addCookies([{ name: 'cpub-consent', value: 'all', domain: 'localhost', path: '/' }]);
    await page.goto(BASE);
    await page.waitForTimeout(2000);

    expect(hits, 'an answer given about a theme cookie cannot load a tracker').toEqual([]);
    const ga = (await context.cookies()).filter((c) => c.name.startsWith('_ga'));
    expect(ga, 'and must not set the provider cookies').toEqual([]);
    await expect(
      page.getByRole('dialog', { name: /cookie consent/i }),
      'the visitor has to be asked about the thing that is actually new',
    ).toBeVisible();
  });

  /**
   * Provider cookies may exist only while consent is granted.
   *
   * This is the invariant, not just the withdrawal behaviour, and it is what
   * CI caught: the first version cleared cookies host-only, so anything the
   * provider had set with an explicit domain survived a withdrawal. Four
   * `_ga*` cookies remained for two names, each alive at both scopings. It
   * passed locally and failed in CI, which is the whole argument for the
   * invariant being enforced on every load rather than at one moment.
   *
   * It also covers two cases withdrawal never reaches: a device carrying
   * cookies from before any of this shipped, and a consent scope that changed
   * so an older grant no longer counts.
   */
  test('provider cookies present without consent are cleared on load', async ({ page, context }) => {
    await context.addCookies([
      { name: '_ga', value: 'GA1.1.seeded', domain: 'localhost', path: '/' },
      { name: '_ga_REFERENCE0', value: 'GS1.1.seeded', domain: 'localhost', path: '/' },
    ]);
    expect((await context.cookies()).filter((c) => c.name.startsWith('_ga')).length).toBeGreaterThan(0);

    await page.goto(BASE);
    await page.waitForTimeout(2500);

    const left = (await context.cookies()).filter((c) => c.name.startsWith('_ga'));
    expect(
      left.map((c) => `${c.name}@${c.domain}`),
      'a device holding provider cookies without a current consent must be cleaned up',
    ).toEqual([]);
  });

  test('a stale REFUSAL is honoured rather than re-asked', async ({ page, context }) => {
    // The other half of the rule. Re-prompting someone who already said no adds
    // friction and changes nothing about what runs, and it is what keeps the
    // shared pre-answered storageState working across a disclosure change.
    await context.addCookies([{ name: 'cpub-consent', value: 'essential', domain: 'localhost', path: '/' }]);
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    await expect(page.getByRole('dialog', { name: /cookie consent/i })).toBeHidden();
  });

  /**
   * THE SHIM SHAPE. This is the defect that reached production in session 253
   * past a green deploy, a 200 on the script and a parsed config: the shim
   * pushed an array where Google's canonical shim pushes `arguments`. gtag.js
   * loaded, `google_tag_manager` initialised the property, every command was in
   * the dataLayer, and no hit was ever sent. The site looked instrumented and
   * measured nothing.
   *
   * Nothing about presence catches that. The shape does, and needs no network.
   */
  test('the gtag shim pushes arguments objects, not arrays', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /accept all/i }).click();
    await page.waitForTimeout(1500);

    const shapes = await page.evaluate(() =>
      (window as unknown as { dataLayer?: unknown[] }).dataLayer!.map((entry) => ({
        isArray: Array.isArray(entry),
        arrayLike: typeof (entry as { length?: number })?.length === 'number',
        first: String((entry as Record<number, unknown>)?.[0] ?? ''),
      })),
    );

    const commands = shapes.filter((s) => ['consent', 'js', 'config', 'set', 'event'].includes(s.first));
    expect(commands.length, 'the loader must have queued its gtag commands').toBeGreaterThan(0);
    for (const c of commands) {
      expect(c.isArray, `gtag command "${c.first}" was pushed as an array; gtag.js ignores those and sends nothing`).toBe(false);
      expect(c.arrayLike, `gtag command "${c.first}" must be an arguments object`).toBe(true);
    }
  });

  test('accepting actually results in a client id, not just a script tag', async ({ page, context }) => {
    // The effect, not the presence. "The script returned 200" was true for the
    // whole time the site was measuring nothing; no `_ga` cookie was the tell.
    await page.goto(BASE);
    await page.getByRole('button', { name: /accept all/i }).click();
    await page.waitForTimeout(3000);
    const ga = (await context.cookies()).filter((c) => c.name === '_ga');
    expect(ga.length, 'gtag.js sets _ga once a config command actually executes').toBe(1);
  });

  /**
   * The privacy page promises that nothing typed into a form reaches the
   * processor. Session 254 measured `/search?q=my+secret+search+term` arriving
   * at Google in the `dl` parameter of a `view_search_results` hit.
   */
  test('what the visitor types never reaches the provider', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => { if (isTagRequest(r.url())) hits.push(r.url()); });

    await page.goto(BASE);
    await page.getByRole('button', { name: /accept all/i }).click();
    await page.waitForTimeout(1500);

    const SECRET = 'zzsecretsearchtermzz';
    await page.goto(`${BASE}/search?q=${SECRET}`);
    await page.waitForTimeout(2500);

    // The dataLayer is the ORACLE here, not the network. Whether Google has
    // flushed a beacon yet depends on its own batching, so asserting on
    // requests alone would be timing-dependent in the positive direction and
    // could pass vacuously in the negative one. What the tag was told is exact.
    const told = await tagCommands(page);
    expect(told.length, 'the loader must have told the tag something').toBeGreaterThan(0);
    expect(
      told.filter((c) => c.includes(SECRET)),
      'the search term was handed to the tag',
    ).toEqual([]);
    expect(
      told.some((c) => c.includes('"page_path":"/search"')),
      'the visit itself is still measured, just without the query',
    ).toBe(true);

    // Belt: nothing carried it over the wire either.
    expect(hits.filter((u) => decodeURIComponent(u).includes(SECRET))).toEqual([]);
  });

  test('pages behind a login are not reported at all', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /accept all/i }).click();
    await page.waitForTimeout(1500);

    // /settings declares the auth middleware, so it is never measured; logged
    // out it redirects to /auth/login, which is not measured either. Titles are
    // the real risk: /messages/:id renders "Message, <person>".
    await page.goto(`${BASE}/settings/profile`);
    await page.waitForTimeout(2000);

    const told = await tagCommands(page);
    for (const path of ['/settings', '/auth/login']) {
      expect(
        told.filter((c) => c.includes(path)),
        `a private route was handed to the tag: ${path}`,
      ).toEqual([]);
    }
    // And no pageview was sent for it at all, under any name.
    expect(told.filter((c) => c.startsWith('["event","page_view"'))).toEqual([]);
  });

  test('withdrawing consent removes the provider cookies from the device', async ({ page, context }) => {
    // "Withdrawing stops any further collection" was on the privacy page while
    // a withdrawn visitor kept both `_ga` cookies and went on emitting beacons.
    await page.goto(BASE);
    await page.getByRole('button', { name: /accept all/i }).click();
    await page.waitForTimeout(2500);
    expect((await context.cookies()).some((c) => c.name.startsWith('_ga'))).toBe(true);

    await page.goto(`${BASE}/cookies`);
    await page.getByRole('button', { name: /withdraw consent/i }).click();
    await page.waitForTimeout(2500);

    const remaining = (await context.cookies()).filter((c) => c.name.startsWith('_ga'));
    // Report name AND domain: the first CI failure here showed only a count of
    // four for two cookie names, which hid the actual cause (each surviving
    // twice, host-only and domain-scoped, because a host-only delete cannot
    // remove a cookie set with an explicit domain).
    expect(
      remaining.map((c) => `${c.name}@${c.domain}`),
      'withdrawal must delete what it set, at every domain scope it was set on',
    ).toEqual([]);
  });
});

/**
 * The CSP and the flag must agree, in BOTH directions.
 *
 * Session 253 shipped a middleware that gated the vendor origins on the config
 * BLOCK rather than the flag, so merely declaring a provider opened the origin.
 * commonpub.io went live allowing googletagmanager while its own privacy page
 * correctly said it used no analytics. This runs unskipped, because the
 * flag-off direction is the one that shipped broken.
 */
test('the CSP advertises the analytics origins if and only if analytics is on', async ({ request }) => {
  const features = await (await request.get(`${BASE}/api/features`)).json();
  const enabled = (features.features ?? features).analytics === true;

  const csp = (await request.get(BASE)).headers()['content-security-policy'] ?? '';
  expect(csp, 'the page must send a CSP at all').not.toBe('');

  const opensVendor = csp.includes('googletagmanager.com');
  expect(
    opensVendor,
    enabled
      ? 'analytics is on, so script-src has to allow the tag or it is blocked'
      : 'analytics is off, so no vendor origin may be opened',
  ).toBe(enabled);
});

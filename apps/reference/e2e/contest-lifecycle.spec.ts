import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Full contest lifecycle — the one E2E that walks a multi-stage contest from
 * creation to ranked results across every persona and every entry path.
 *
 * Why this exists: the unit suites were 1600+ green while two contest bugs were
 * live in production (session 251). Neither was reachable from a unit test — one
 * needed a real `<input type="number">` to coerce a model, the other needed the
 * editor's layout-less page to swallow a toast. This spec covers the seams
 * between the pieces, which is where those failures live.
 *
 * Shape: the API is used for SETUP and for verifying stored state (fast and
 * deterministic); the browser drives everything a participant actually clicks.
 *
 * Requires the contest feature flags — CI sets them in the e2e job env.
 */

const S = Date.now();
const uniq = (p: string) => `${p}${S}`.slice(0, 24);

interface Persona { handle: string; username: string; ctx: BrowserContext; page: Page }

let BASE: string;
let ORIGIN: Record<string, string>;
let slug: string;
let contestUrl: string;
let olive: Persona;
let fiona: Persona;
let dan: Persona;
let jae: Persona;
let danProjectId: string;

/** Sign up a fresh user (auto-creates a session) and give them a page. */
async function makePersona(browser: import('@playwright/test').Browser, handle: string): Promise<Persona> {
  const ctx = await browser.newContext();
  const username = uniq(handle);
  const res = await ctx.request.post(`${BASE}/api/auth/sign-up/email`, {
    data: { email: `${handle}-${S}@example.com`, password: 'Password123!', username, name: handle },
  });
  expect(res.ok(), `sign-up ${handle}: ${res.status()}`).toBeTruthy();
  return { handle, username, ctx, page: await ctx.newPage() };
}

/** Poll the API until a predicate holds. Every write in this spec lands
 *  asynchronously behind a click, so asserting after a fixed sleep is a flake
 *  generator — this retries until the state actually arrives. */
async function pollJson<T>(
  ctx: BrowserContext,
  path: string,
  predicate: (body: T) => boolean,
  message: string,
): Promise<T> {
  let last: T | undefined;
  await expect
    .poll(async () => {
      const res = await ctx.request.get(`${BASE}${path}`);
      if (!res.ok()) return false;
      last = (await res.json()) as T;
      return predicate(last);
    }, { message, timeout: 20_000, intervals: [300, 500, 1000] })
    .toBe(true);
  return last as T;
}

/** The hero's call-to-action labels — the contest's primary affordance. */
async function heroCtas(page: Page): Promise<string[]> {
  await page.waitForSelector('.cpub-hero-cta', { timeout: 30_000 });
  // The viewer's own registration state is fetched client-side (server:false),
  // so the CTA settles a beat after paint.
  await page.waitForTimeout(1200);
  return page.$$eval('.cpub-hero-cta a, .cpub-hero-cta button', (els) =>
    els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()),
  );
}

test.describe('Contest lifecycle', () => {
  test.describe.configure({ mode: 'serial' });
  // One heavy, stateful walk. CI runs chromium only; there is nothing
  // browser-specific here, so paying for it three times locally is waste.
  test.skip(({ browserName }) => browserName !== 'chromium', 'lifecycle runs on chromium only');

  test.beforeAll(async ({ browser }) => {
    BASE = test.info().project.use.baseURL ?? 'http://localhost:3000';
    ORIGIN = { origin: BASE };
    olive = await makePersona(browser, 'olive');
    fiona = await makePersona(browser, 'fiona');
    dan = await makePersona(browser, 'dan');
    jae = await makePersona(browser, 'jae');

    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const created = await olive.ctx.request.post(`${BASE}/api/contests`, {
      headers: ORIGIN,
      data: {
        title: `Lifecycle Cup ${S}`,
        subheading: 'Build something that keeps working when the grid does not.',
        description: 'Exercises every contest path end to end.',
        startDate: iso(now - 2 * 864e5),
        endDate: iso(now + 20 * 864e5),
        judgingEndDate: iso(now + 30 * 864e5),
        currentStageId: 'proposals',
        stages: [
          { id: 'proposals', name: 'Proposals', kind: 'submission', submissionMode: 'proposal',
            startsAt: iso(now - 2 * 864e5), endsAt: iso(now + 7 * 864e5),
            submissionTemplate: [
              { key: 'pitch', label: 'One-line pitch', type: 'text', required: true },
              { key: 'team_size', label: 'Team size', type: 'number', required: false },
            ] },
          { id: 'screening', name: 'Screening', kind: 'review', endsAt: iso(now + 10 * 864e5), advanceCount: 1 },
          { id: 'prototype', name: 'Prototype', kind: 'submission', endsAt: iso(now + 20 * 864e5) },
          { id: 'final', name: 'Final judging', kind: 'review', endsAt: iso(now + 30 * 864e5) },
          { id: 'results', name: 'Results', kind: 'results', endsAt: iso(now + 32 * 864e5) },
        ],
        // Every input type the form builder offers, so a coercion bug in any one
        // of them fails here rather than in production.
        registrationTemplate: [
          { key: 'about', label: 'About you', type: 'section', required: false },
          { key: 'team', label: 'Team name', type: 'text', required: true },
          { key: 'size', label: 'Team size', type: 'number', required: false },
          { key: 'track', label: 'Track', type: 'select', required: false,
            options: [{ value: 'energy', label: 'Energy' }, { value: 'water', label: 'Water' }] },
          { key: 'site', label: 'Project URL', type: 'url', required: false },
          { key: 'bio', label: 'About your build', type: 'textarea', required: false },
          { key: 'newsletter', label: 'Send me the newsletter', type: 'checkbox', required: false },
          { key: 'rules_ok', label: 'I accept the contest rules', type: 'agreement', required: true,
            terms: 'You agree to the contest rules.' },
        ],
        // NB: `weight` IS the criterion's max points (rubricCriterionMax); the
        // contest editor labels this field "pts".
        judgingCriteria: [{ label: 'Impact', weight: 10 }, { label: 'Craft', weight: 10 }],
        eligibleContentTypes: ['project'],
      },
    });
    expect(created.ok(), `contest create: ${created.status()} ${await created.text()}`).toBeTruthy();
    slug = (await created.json()).slug;
    contestUrl = `/contests/${slug}`;
    const active = await olive.ctx.request.post(`${BASE}/api/contests/${slug}/transition`, {
      headers: ORIGIN, data: { status: 'active' },
    });
    expect(active.ok()).toBeTruthy();

    // Dan brings a published project to enter with.
    const proj = await olive.ctx.request.post(`${BASE}/api/content`, { headers: ORIGIN, data: { type: 'project', title: 'x' } });
    expect(proj.ok()).toBeTruthy(); // sanity: content API reachable before we lean on it
    const danProj = await dan.ctx.request.post(`${BASE}/api/content`, {
      headers: ORIGIN,
      data: { type: 'project', title: `Dan's Grid Buffer ${S}`, description: 'A battery buffer.' },
    });
    danProjectId = (await danProj.json()).id;
    await dan.ctx.request.put(`${BASE}/api/content/${danProjectId}`, { headers: ORIGIN, data: { status: 'published' } });
  });

  test.afterAll(async () => {
    for (const p of [olive, fiona, dan, jae]) await p?.ctx.close();
  });

  test('anonymous visitor is asked to log in, never shown a submit that would fail', async ({ page }) => {
    await page.goto(contestUrl);
    const ctas = await heroCtas(page);
    expect(ctas.join('|')).toContain('Log in to register');
    expect(ctas.join('|')).not.toContain('Submit Entry');

    // Stage-aware chrome: the CURRENT stage, not the final end date.
    await expect(page.locator('.cpub-stage-chip')).toContainText(/Proposals/i);
    const steps = await page.$$eval('.cpub-tl-label', (e) => e.length);
    expect(steps, 'sidebar timeline lists every stage').toBeGreaterThanOrEqual(5);
    expect(await page.locator('.cpub-tl-now').count(), 'exactly one stage is current').toBe(1);

    // The registration page is auth-gated and returns you afterwards. The bounce
    // is a CLIENT-side redirect, which aborts the in-flight navigation — goto then
    // rejects with net::ERR_ABORTED even though the redirect is working (it went
    // flaky in CI exactly this way). Swallow the abort; the URL is the real check,
    // and toHaveURL retries until the redirect settles.
    await page.goto(`${contestUrl}/register`).catch(() => { /* client redirect */ });
    await expect(page).toHaveURL(/\/auth\/login\?redirect=/, { timeout: 20_000 });
  });

  test('following a contest is not registering, and does not let you enter', async () => {
    const { page, ctx } = fiona;
    await page.goto(contestUrl);
    await page.waitForSelector('.cpub-signup', { timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.locator('.cpub-signup button:has-text("Follow this contest")').click();
    await expect(page.locator('.cpub-signup')).toContainText(/You're following this contest/i, { timeout: 15_000 });

    const reg = await pollJson<{ tier: string; count: number; followerCount: number }>(
      ctx, `/api/contests/${slug}/register`, (r) => r.tier === 'reminders', 'follow records tier=reminders',
    );
    expect(reg.count, 'a follower is not a counted participant').toBe(0);
    expect(reg.followerCount).toBe(1);

    // The server gate must agree with the UI: following is not enough to enter.
    const blocked = await ctx.request.post(`${BASE}/api/contests/${slug}/entries`, {
      headers: ORIGIN, data: { contentId: crypto.randomUUID() },
    });
    expect(blocked.status(), 'entry from a follower is refused as unauthorized, not malformed').toBe(403);
    expect((await heroCtas(page)).join('|')).toContain('Register for the contest');
  });

  test('registration form collects every field type and upgrades the follower', async () => {
    const { page, ctx } = fiona;
    await page.goto(`${contestUrl}/register`);
    await page.waitForSelector('.cpub-regform', { timeout: 30_000 });
    await page.waitForTimeout(1000);

    await expect(page.locator('.cpub-regform-save'), 'save is blocked until required fields are met').toBeDisabled();

    await page.fill('#cpub-regpage-team', 'Night Shift');
    await page.fill('#cpub-regpage-size', '4');                       // number: must stay a string on the wire
    await page.selectOption('#cpub-regpage-track', 'water');
    await page.fill('#cpub-regpage-site', 'https://example.com/ns');
    await page.fill('#cpub-regpage-bio', 'A solar-buffered water pump.');
    await page.locator('#cpub-regpage-newsletter').check();
    await page.locator('.cpub-regform input[type="checkbox"]').last().check();  // the agreement
    await expect(page.locator('.cpub-regform-save')).toBeEnabled();
    await page.locator('.cpub-regform-save').click();

    const reg = await pollJson<{ tier: string; fields: Record<string, unknown> }>(
      ctx, `/api/contests/${slug}/register`, (r) => r.tier === 'full', 'reminders upgrades to full on save',
    );
    // Every answer survives as a STRING — a number/select/checkbox that coerced
    // used to be dropped silently, taking the form down with it.
    expect(reg.fields).toMatchObject({
      team: 'Night Shift', size: '4', track: 'water', newsletter: 'true', rules_ok: 'true',
    });
    for (const v of Object.values(reg.fields as Record<string, unknown>)) expect(typeof v).toBe('string');

    await page.goto(contestUrl);
    const ctas = await heroCtas(page);
    expect(ctas.join('|'), 'a registered participant is offered Submit Entry').toContain('Submit Entry');
    expect(ctas.join('|')).not.toContain('Register for');
  });

  test('an unregistered entrant is routed through registration, then can submit', async () => {
    const { page, ctx } = dan;
    await page.goto(contestUrl);
    expect((await heroCtas(page)).join('|')).toContain('Register for this contest');

    // The entries tab is the other way in — it must gate identically.
    await page.goto(`${contestUrl}?tab=entries`);
    await page.waitForSelector('.cpub-entries-cta', { timeout: 30_000 });
    await page.waitForTimeout(1200);
    await expect(page.locator('.cpub-entries-cta')).toContainText(/Register to enter this contest/i);
    await page.locator('.cpub-entries-cta button:has-text("Register")').click();
    await expect(page).toHaveURL(new RegExp(`${slug}/register$`), { timeout: 20_000 });

    await page.waitForSelector('.cpub-regform', { timeout: 30_000 });
    await page.fill('#cpub-regpage-team', 'Grid Buffers');
    await page.locator('.cpub-regform input[type="checkbox"]').last().check();
    await page.locator('.cpub-regform-save').click();
    await pollJson<{ tier: string }>(ctx, `/api/contests/${slug}/register`, (r) => r.tier === 'full', 'Dan is registered');

    // Now the picker opens and lists only this entrant's own published work.
    await page.goto(`${contestUrl}?tab=entries`);
    await page.waitForTimeout(1500);
    await page.locator('.cpub-entries-cta button:has-text("Submit Entry")').click();
    await page.waitForSelector('.cpub-submit-dialog', { timeout: 20_000 });
    await expect(page.locator('.cpub-submit-tile-title').first()).toContainText("Dan's Grid Buffer");
    await page.locator('.cpub-submit-tile').first().click();
    await page.locator('.cpub-submit-footer button:has-text("Submit")').click();
    await pollJson<{ items: { authorUsername: string }[] }>(
      ctx, `/api/contests/${slug}/entries`,
      (r) => r.items.some((e) => e.authorUsername === dan.username), 'the entry appears under Dan',
    );
  });

  test('a proposal-mode stage accepts a form entry with no pre-existing project', async ({ browser }) => {
    const pia = await makePersona(browser, 'pia');
    await pia.ctx.request.post(`${BASE}/api/contests/${slug}/register`, {
      headers: ORIGIN, data: { tier: 'full', fields: { team: 'Rainmakers', rules_ok: 'true' } },
    });
    await pia.page.goto(`${contestUrl}?tab=entries`);
    await pia.page.waitForSelector('.cpub-proposal', { timeout: 30_000 });
    await pia.page.waitForTimeout(1200);

    await pia.page.fill('#cpub-proposal-pitch', 'Rain capture with a solar pump');
    await pia.page.fill('#cpub-proposal-team_size', '3');   // number field inside the ENTRY form
    const submit = pia.page.locator('.cpub-proposal button[type="submit"], .cpub-proposal .cpub-btn-primary').first();
    await expect(submit, 'a number answer must not disable the form').toBeEnabled();
    await submit.click();
    await pollJson<{ items: { authorUsername: string }[] }>(
      pia.ctx, `/api/contests/${slug}/entries`,
      (r) => r.items.some((e) => e.authorUsername === pia.username), 'the proposal creates an entry',
    );
    await pia.ctx.close();
  });

  test('organizer can review registrants and export, participants cannot', async () => {
    const registrants = await (await olive.ctx.request.get(`${BASE}/api/contests/${slug}/registrants`)).json();
    expect(registrants.items.length, 'full participants only (fiona, dan, pia)').toBe(3);

    const csv = await olive.ctx.request.get(`${BASE}/api/contests/${slug}/export`);
    expect(csv.ok()).toBeTruthy();
    expect(csv.headers()['content-type']).toContain('text/csv');
    expect((await olive.ctx.request.get(`${BASE}/api/contests/${slug}/registrants-export`)).ok()).toBeTruthy();

    const leak = await dan.ctx.request.get(`${BASE}/api/contests/${slug}/registrants-export`);
    expect(leak.status(), 'a participant cannot export registrant PII').toBe(403);
  });

  test('judging: invite, accept, score against the rubric, advance, rank', async () => {
    const me = await (await jae.ctx.request.get(`${BASE}/api/me`)).json();
    const invited = await olive.ctx.request.post(`${BASE}/api/contests/${slug}/judges`, {
      headers: ORIGIN, data: { userId: me.id ?? me.user?.id, role: 'judge' },
    });
    expect(invited.ok()).toBeTruthy();

    await jae.page.goto(contestUrl);
    await jae.page.waitForSelector('.cpub-invite-banner', { timeout: 30_000 });
    // The banner is server-rendered, so it is clickable BEFORE Vue hydrates and an
    // early click is swallowed. Retry the click until it takes effect rather than
    // guessing at a sleep — the banner clearing is the signal that it landed.
    await expect(async () => {
      await jae.page.locator('.cpub-invite-banner button').click({ timeout: 5_000 });
      await expect(jae.page.locator('.cpub-invite-banner')).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await pollJson<{ acceptedAt: string | null }[]>(
      olive.ctx, `/api/contests/${slug}/judges`,
      (j) => j.some((x) => !!x.acceptedAt), 'judge acceptance is recorded',
    );

    expect((await olive.ctx.request.post(`${BASE}/api/contests/${slug}/transition`, {
      headers: ORIGIN, data: { status: 'judging' },
    })).ok()).toBeTruthy();

    // Entries close the moment judging starts.
    const late = await dan.ctx.request.post(`${BASE}/api/contests/${slug}/entries`, {
      headers: ORIGIN, data: { contentId: danProjectId },
    });
    expect(late.status()).toBe(400);

    await jae.page.goto(`${contestUrl}/judge`);
    await jae.page.waitForTimeout(3000);
    const judgeCopy = await jae.page.evaluate(() => document.body.innerText);
    // The instructions must describe the rubric actually rendered: with criteria,
    // each is scored against its OWN max, and a flat "0 to 100" would be rejected.
    expect(judgeCopy).toContain('criterion against its own maximum');
    expect(judgeCopy).not.toContain('Score each entry from 0 to 100');

    const entries = (await (await olive.ctx.request.get(`${BASE}/api/contests/${slug}/entries`)).json()).items;
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const [i, e] of entries.entries()) {
      const scored = await jae.ctx.request.post(`${BASE}/api/contests/${slug}/judge`, {
        headers: ORIGIN,
        data: { entryId: e.id, criteriaScores: [{ label: 'Impact', score: 9 - i, max: 10 }, { label: 'Craft', score: 8 - i, max: 10 }] },
      });
      expect(scored.ok(), `score entry ${i}: ${scored.status()} ${await scored.text()}`).toBeTruthy();
    }

    const notJudge = await dan.ctx.request.post(`${BASE}/api/contests/${slug}/judge`, {
      headers: ORIGIN, data: { entryId: entries[0].id, score: 100 },
    });
    expect([401, 403]).toContain(notJudge.status());

    const advanced = await olive.ctx.request.post(`${BASE}/api/contests/${slug}/advance`, {
      headers: ORIGIN, data: { reviewStageId: 'screening', mode: 'topN', topN: 1 },
    });
    expect(advanced.ok(), `advance: ${advanced.status()} ${await advanced.text()}`).toBeTruthy();
    const afterCut = (await (await olive.ctx.request.get(`${BASE}/api/contests/${slug}/entries`)).json()).items;
    expect(afterCut.filter((e: { eliminated: boolean }) => !e.eliminated).length, 'only the top 1 survives the cut').toBe(1);

    expect((await olive.ctx.request.post(`${BASE}/api/contests/${slug}/transition`, {
      headers: ORIGIN, data: { status: 'completed' },
    })).ok()).toBeTruthy();
    await pollJson<{ items: { rank: number | null }[] }>(
      olive.ctx, `/api/contests/${slug}/entries`,
      (r) => r.items.some((e) => e.rank != null), 'completion assigns ranks',
    );
  });

  test('results are public, and registration is closed once the contest ends', async ({ page }) => {
    await page.goto(`${contestUrl}/results`);
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText(/Results/i);
    await expect(page.locator('body')).toContainText(/Full Standings/i);

    const closed = await fiona.ctx.request.post(`${BASE}/api/contests/${slug}/register`, {
      headers: ORIGIN, data: { tier: 'full' },
    });
    expect(closed.ok(), 'a completed contest accepts no new registrations').toBeFalsy();

    // Both public surfaces must survive a phone viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [contestUrl, `${contestUrl}/results`]) {
      await page.goto(path);
      await page.waitForTimeout(1500);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${path} overflows at 390px`).toBeLessThanOrEqual(390);
    }
  });
});

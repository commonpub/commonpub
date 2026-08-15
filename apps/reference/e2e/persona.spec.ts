import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFeatures, signUp, type E2EAccount } from './helpers/account';

/**
 * The persona round trip, in a real browser.
 *
 * Why this exists: a manual pass found two blockers that 1600+ green unit tests
 * missed. Both lived in seams jsdom cannot reach. This spec walks the seams:
 *
 *  - a chip grid filled by a real pointer, saved, and read back after a RELOAD,
 *    which is the only thing that proves the value reached Postgres rather than
 *    a reactive ref;
 *  - saving a persona writing NO sharing consent, asserted on the surface a
 *    member would look at rather than on the row a unit test would query. This
 *    is the no-bundling rule (persona plan 6.8) and it is the one rule whose
 *    breach a member would never notice;
 *  - revocation costing exactly ONE click with no confirmation step, which is
 *    an interaction property, not a function;
 *  - the answers reaching a stranger's view of the profile;
 *  - a 44px target and a page that does not scroll sideways at 390px, which is
 *    precisely what jsdom cannot answer because it has no layout at all.
 *
 * Requires `features.persona`. The reference app turns it on in
 * `commonpub.config.ts`; every test below reads `/api/features` and skips
 * rather than failing on an instance that does not.
 */

const INTERESTS_SECTION = 'interests';
/**
 * `PersonaSectionEditor` passes `:id-prefix="sectionId"` down, where `sectionId`
 * is `${idPrefix}-${section.key}` and the page leaves `idPrefix` at its
 * `cpub-persona` default. `PersonaChipGrid` then names every checkbox
 * `${idPrefix}-${field.key}`. The interests section holds a single field also
 * keyed `interests`, so the name doubles up. Deriving it here rather than
 * hardcoding one string keeps the two halves of that rule visible.
 */
const CHIP_NAME = `cpub-persona-${INTERESTS_SECTION}-interests`;

/** Two built-in interest OPTION VALUES, and their rendered labels. */
const PICKED = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'robotics', label: 'Robotics' },
] as const;
/** A third option, never picked, so "persisted" cannot mean "everything is on". */
const NOT_PICKED = { value: 'iot', label: 'IoT' } as const;

let BASE: string;
let flags: Record<string, boolean>;
let member: E2EAccount;

function chip(page: Page, value: string): Locator {
  return page.locator(`input[name="${CHIP_NAME}"][value="${value}"]`);
}

/**
 * The chip grid's polite live region. It is rendered from the MODEL, so it is
 * the honest oracle for "did that click reach Vue" as opposed to "did the
 * browser tick a box". A click landing before hydration ticks the box and
 * changes nothing else, which is exactly the failure this distinguishes.
 */
function chipStatus(page: Page): Locator {
  return page.locator(`#${CHIP_NAME}-status`);
}

/**
 * Every persona section is open by index; interests is index 1, so it starts
 * open.
 *
 * Deliberately NOT `waitForLoadState('networkidle')`. The Nuxt dev server never
 * reaches network idle (HMR keeps a connection warm) and Playwright's default
 * navigation timeout is 0, so that call waits forever and the failure surfaces
 * as whichever assertion happened to be next. Every wait below is on something
 * this spec actually needs.
 */
async function openPersonaEditor(page: Page): Promise<void> {
  await page.goto('/settings/persona');
  await page.waitForSelector('.cpub-persona-sections', { timeout: 60_000 });
}

async function openPrivacySettings(page: Page): Promise<void> {
  await page.goto('/settings/privacy');
  await page.waitForSelector('.cpub-privacy-settings', { timeout: 60_000 });
}

/**
 * Drive a `role="switch"` to a wanted state, idempotently.
 *
 * Clicks ONLY when the control is in the wrong state, so retrying cannot flip
 * it past the target. That matters because the switch is server-rendered and a
 * click that lands before hydration is swallowed with no error: without the
 * retry this is flaky, and with a naive retry it toggles twice.
 *
 * The revocation test deliberately does NOT use this. Counting the clicks is
 * the whole assertion there.
 */
async function setSwitch(control: Locator, want: boolean): Promise<void> {
  const target = want ? 'true' : 'false';
  await expect(async () => {
    if ((await control.getAttribute('aria-checked')) !== target) {
      await control.click();
    }
    await expect(control).toHaveAttribute('aria-checked', target, { timeout: 1500 });
  }).toPass({ timeout: 45_000 });
}

/** The purpose rows the server holds for this member, which is the record of record. */
async function serverPurposes(): Promise<Array<{ id: string; state: string; needsReconfirmation: boolean }>> {
  const res = await member.ctx.request.get(`${BASE}/api/consent/purposes`);
  expect(res.ok(), `GET /api/consent/purposes: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as {
    purposes: Array<{ id: string; state: string; needsReconfirmation: boolean }>;
  };
  return body.purposes ?? [];
}

test.describe('Persona round trip', () => {
  // Serial: the state flows from one test to the next, exactly as a person's
  // does. 120s because these walk real pages on a dev server that compiles
  // routes on first hit.
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  // CI runs chromium only and nothing here is browser specific. The 390px
  // assertions set their own viewport rather than relying on the mobile
  // project, so they run in this project too.
  test.skip(({ browserName }) => browserName !== 'chromium', 'persona walk runs on chromium only');

  test.beforeAll(async ({ browser }) => {
    BASE = test.info().project.use.baseURL ?? 'http://localhost:3000';
    member = await signUp(browser, BASE, 'persona');
    flags = await readFeatures(member.ctx, BASE);
  });

  test.afterAll(async () => {
    await member?.close();
  });

  test('a chip grid saves one section, and the answers survive a reload', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    const { page } = member;

    await openPersonaEditor(page);

    const save = page.getByRole('button', { name: 'Save Interests' });
    await expect(save, 'the interests section renders its own Save').toBeVisible();
    await expect(save, 'nothing is dirty yet, so Save is a no-op and is disabled').toBeDisabled();

    // Tick until the MODEL agrees. A click before hydration ticks the box and
    // leaves the model empty, which is silent: no error, no failed assertion,
    // and a Save that stays disabled forever.
    await expect(async () => {
      await chip(page, PICKED[0].value).click();
      await expect(chipStatus(page)).toHaveText(/1 selected\./, { timeout: 1500 });
    }).toPass({ timeout: 45_000 });

    await chip(page, PICKED[1].value).check();
    await expect(chipStatus(page)).toHaveText(/2 selected\./);
    await expect(save, 'a dirty section can be saved').toBeEnabled();

    await save.click();
    await expect(page.locator('.cpub-toast')).toContainText('Saved', { timeout: 20_000 });

    // THE assertion. Not "the ref updated" and not "the request was sent": a
    // fresh document, a fresh fetch, and the boxes are still ticked.
    await page.reload();
    await page.waitForSelector('.cpub-persona-sections', { timeout: 30_000 });
    for (const pick of PICKED) {
      await expect(chip(page, pick.value), `${pick.value} did not survive the reload`).toBeChecked();
    }
    await expect(
      chip(page, NOT_PICKED.value),
      'an untouched option must not come back ticked',
    ).not.toBeChecked();

    // And the server holds the option VALUES, not the labels. A store that kept
    // labels would relabel every past answer the next time the copy changed.
    const stored = (await (await member.ctx.request.get(`${BASE}/api/persona`)).json()) as {
      values: { answers: Record<string, string[]> };
    };
    expect(stored.values.answers.interests?.slice().sort()).toEqual(
      PICKED.map((p) => p.value).slice().sort(),
    );
  });

  test('saving a persona records no sharing consent at all', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    test.skip(flags.dataSharingConsents !== true, 'features.dataSharingConsents is off on this instance');
    const { page } = member;

    await openPrivacySettings(page);

    const switches = page.getByRole('switch');
    const count = await switches.count();
    // A guard needs its own guard. Zero switches would make the loop below pass
    // while proving nothing at all, which is the shape of a test that quietly
    // stopped testing.
    expect(count, 'the privacy page must offer at least one sharing choice').toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      await expect(
        switches.nth(i),
        'filling in a persona must never turn a sharing choice on',
      ).toHaveAttribute('aria-checked', 'false');
    }

    // The page could be lying by omission, so ask the server too.
    for (const purpose of await serverPurposes()) {
      expect(purpose.state, `${purpose.id} was granted by a persona save`).not.toBe('granted');
    }
  });

  test('granting analytics reads as on after a reload', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    test.skip(flags.dataSharingConsents !== true, 'features.dataSharingConsents is off on this instance');
    const { page } = member;

    await openPrivacySettings(page);
    const analytics = page.getByRole('switch', { name: /community statistics/i });
    await expect(analytics, 'the analytics purpose is the one this instance offers').toBeVisible();

    await setSwitch(analytics, true);
    await expect(page.locator('.cpub-toast')).toContainText('Turned on', { timeout: 20_000 });

    await page.reload();
    await page.waitForSelector('.cpub-privacy-settings', { timeout: 30_000 });
    await expect(
      page.getByRole('switch', { name: /community statistics/i }),
      'a grant that does not survive a reload was never recorded',
    ).toHaveAttribute('aria-checked', 'true');

    const analyticsRow = (await serverPurposes()).find((p) => p.id === 'profile_analytics');
    expect(analyticsRow?.state).toBe('granted');
    expect(analyticsRow?.needsReconfirmation, 'a fresh grant is current, not stale').toBe(false);
  });

  test('revoking takes one click and shows no confirmation step', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    test.skip(flags.dataSharingConsents !== true, 'features.dataSharingConsents is off on this instance');
    const { page } = member;

    await openPrivacySettings(page);

    // Hydration barrier with a REASON: `humanDate` returns '' until `onMounted`
    // runs, so a non-empty date in the history table proves the client app is
    // live. The previous test wrote the row this reads. Without a barrier the
    // single click below could land on server-rendered markup and be swallowed,
    // and the whole point of this test is that there is exactly one click.
    const firstDate = page.locator('.cpub-history-table time').first();
    await expect(firstDate, 'the grant from the previous test is on record').toBeVisible({ timeout: 20_000 });
    await expect(firstDate, 'client app is hydrated').not.toHaveText('', { timeout: 20_000 });

    // A native confirm()/alert() would satisfy an "are you sure" flow without
    // adding any DOM, so watch for both kinds of confirmation.
    let nativeDialog: string | null = null;
    page.on('dialog', async (d) => {
      nativeDialog = d.message();
      await d.dismiss();
    });

    const analytics = page.getByRole('switch', { name: /community statistics/i });
    await expect(analytics).toHaveAttribute('aria-checked', 'true');

    await analytics.click(); // exactly one, deliberately not retried

    await expect(
      analytics,
      'one click on the same control must be enough to say no',
    ).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });

    expect(nativeDialog, 'refusing must not raise a browser confirmation').toBeNull();
    expect(
      await page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible, dialog[open]').count(),
      'refusing must not open a confirmation dialog',
    ).toBe(0);

    const analyticsRow = (await serverPurposes()).find((p) => p.id === 'profile_analytics');
    expect(analyticsRow?.state, 'the revocation reached the server').toBe('revoked');
  });

  test('the chosen answers appear on the public profile, for the owner and for a stranger', async ({ page: stranger }) => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');

    for (const [who, page] of [['owner', member.page], ['stranger', stranger]] as const) {
      await page.goto(`/u/${member.username}`);
      // `<PersonaPublicDisplay>` is mounted inside the profile's ABOUT tab, and
      // the page opens on Overview. The tab is a client-side ref with no URL
      // state, so this has to be a real click; retried as a unit because a
      // click landing before hydration is swallowed with no error. That the
      // answers live one tab in is exactly the kind of fact a component test
      // cannot see.
      //
      // NOT `exact: true`. Every tab button carries a Font Awesome `<i>`, and
      // Chromium folds the icon font's `::before` glyph into the accessible
      // name, so the name is a private-use character followed by "About" and an
      // exact match never fires.
      await expect(async () => {
        await page.getByRole('button', { name: 'About' }).click();
        await expect(page.locator('.cpub-persona-public')).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 45_000 });
      const block = page.locator('.cpub-persona-public');
      for (const pick of PICKED) {
        await expect(block, `${who} cannot see ${pick.label}`).toContainText(pick.label);
      }
      await expect(
        block,
        'an option nobody picked must not be rendered',
      ).not.toContainText(NOT_PICKED.label);
    }
  });

  test('at 390px every chip clears 44px and the page does not scroll sideways', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    const { page } = member;

    await page.setViewportSize({ width: 390, height: 844 });
    await openPersonaEditor(page);
    await page.waitForSelector('.cpub-chip', { timeout: 30_000 });
    // Grid tracks settle a frame after the fonts land; a height measured mid
    // reflow is a false failure.
    await page.waitForTimeout(500);

    // Scoped to the OPEN interests grid. A bare `.cpub-chip` sweep also picks
    // up the tech-stack section, which starts collapsed behind `[hidden]` and
    // therefore measures 0 high: the assertion would fail on a control nobody
    // can see, and the same sweep with `Math.max` would have passed on one that
    // was 20px.
    const heights = await page.$$eval(
      `.cpub-chip:has(input[name="${CHIP_NAME}"])`,
      (els) => els.map((el) => el.getBoundingClientRect().height),
    );
    // Walked-N guard: an empty list would make `Math.min` return Infinity and
    // the assertion below would pass against nothing.
    expect(heights.length, 'the interests grid must have rendered chips to measure').toBeGreaterThan(5);
    expect(
      Math.min(...heights),
      'a chip is the densest control on the page and still has to clear the WCAG 2.1 AA 44px target',
    ).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(
      overflow.scrollWidth,
      `the persona editor overflows at 390px (${overflow.scrollWidth} > ${overflow.innerWidth})`,
    ).toBeLessThanOrEqual(overflow.innerWidth);

    // The privacy page carries a table, which is the usual way a settings page
    // learns to scroll sideways.
    if (flags.dataSharingConsents === true) {
      await openPrivacySettings(page);
      await page.waitForTimeout(500);
      const privacyOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        privacyOverflow.scrollWidth,
        `the privacy page overflows at 390px (${privacyOverflow.scrollWidth} > ${privacyOverflow.innerWidth})`,
      ).toBeLessThanOrEqual(privacyOverflow.innerWidth);

      const switchBox = await page.getByRole('switch').first().boundingBox();
      expect(switchBox, 'the sharing switch renders at 390px').not.toBeNull();
      expect(
        switchBox!.height,
        'the control that grants and revokes has to clear 44px on a phone',
      ).toBeGreaterThanOrEqual(44);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
  });
});

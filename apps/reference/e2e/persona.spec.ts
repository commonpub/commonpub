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
 *  - objecting to statistics costing exactly ONE click with no confirmation
 *    step, which is an interaction property, not a function;
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
  // The canonical path since the settings merge. `/settings/persona` still
  // redirects here and a test below pins that, but the helper navigates
  // directly so a broken redirect fails one named test rather than every test
  // in this file.
  await page.goto('/settings/profile/questions');
  await page.waitForSelector('.cpub-questions-page', { timeout: 60_000 });
}

/**
 * The settings merge kept `/settings/persona` as a redirect rather than renaming
 * it, because the invitation banner links there and so did every older bookmark.
 * Nothing else covers it now that `openPersonaEditor` navigates directly, and a
 * silently broken redirect would strand anyone arriving from the banner.
 */
async function assertLegacyPersonaPathRedirects(page: Page): Promise<void> {
  await page.goto('/settings/persona');
  await page.waitForSelector('.cpub-questions-page', { timeout: 60_000 });
  expect(new URL(page.url()).pathname).toBe('/settings/profile/questions');
}

async function openPrivacySettings(page: Page): Promise<void> {
  await page.goto('/settings/privacy');
  await page.waitForSelector('.cpub-privacy-settings', { timeout: 60_000 });
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

/** The objection row the server holds for this member. */
async function serverObjection(): Promise<{ objected: boolean; state: string }> {
  const res = await member.ctx.request.get(`${BASE}/api/consent/objection`);
  expect(res.ok(), `GET /api/consent/objection: ${res.status()}`).toBeTruthy();
  return (await res.json()) as { objected: boolean; state: string };
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

  test('the old /settings/persona path still lands on the questions tab', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    await assertLegacyPersonaPathRedirects(member.page);
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
    await page.waitForSelector('.cpub-questions-page', { timeout: 30_000 });
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
    // A guard needs its own guard, and the guard itself had to change. Zero
    // switches is now the CORRECT state on an instance that has declared no
    // recipient: both surviving purposes require one, so there is nothing to
    // ask and the page shows no sharing section at all. Asserting "at least one
    // switch" would fail on a correctly configured makerspace. What still has
    // to hold is that whatever switches exist are OFF, and the server agrees.
    const serverRows = await serverPurposes();
    expect(
      count,
      'a switch on the page for every purpose the server offers, and no more',
    ).toBe(serverRows.length);

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

  test('objecting to statistics reads as objected after a reload', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    test.skip(flags.personaAnalytics !== true, 'features.personaAnalytics is off on this instance');
    const { page } = member;

    await openPrivacySettings(page);

    // Deliberately NOT a `role="switch"`. Every switch on this page reads "off
    // means nothing is happening", and a switch whose off state meant "you are
    // counted" would be read backwards by everyone who learned the rest of the
    // page. The control is a button whose LABEL is the objection.
    const objectButton = page.locator('.cpub-statistics-action');
    await expect(objectButton, 'the statistics card offers the objection').toBeVisible();
    await expect(
      objectButton,
      'nobody has objected yet, so the button offers to object',
    ).toHaveText(/leave me out|do not count/i);

    await objectButton.click();

    await expect(
      page.locator('.cpub-statistics-status').first(),
      'the status line has to change with the row, not with the click',
    ).toContainText(/not counted|left out/i, { timeout: 20_000 });

    await page.reload();
    await page.waitForSelector('.cpub-privacy-settings', { timeout: 30_000 });
    await expect(
      page.locator('.cpub-statistics-action'),
      'an objection that does not survive a reload was never recorded',
    ).toHaveText(/count me|include me/i);

    const row = await serverObjection();
    expect(row.objected, 'the objection reached the server').toBe(true);
    expect(row.state).toBe('objected');
  });

  test('withdrawing the objection takes one click and shows no confirmation step', async () => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');
    test.skip(flags.personaAnalytics !== true, 'features.personaAnalytics is off on this instance');
    const { page } = member;

    await openPrivacySettings(page);

    // A native confirm()/alert() would satisfy an "are you sure" flow without
    // adding any DOM, so watch for both kinds of confirmation.
    let nativeDialog: string | null = null;
    page.on('dialog', async (d) => {
      nativeDialog = d.message();
      await d.dismiss();
    });

    const action = page.locator('.cpub-statistics-action');
    await expect(action, 'the previous test left an objection on record').toHaveText(
      /count me|include me/i,
      { timeout: 20_000 },
    );

    await action.click(); // exactly one, deliberately not retried

    await expect(
      action,
      'one click on the same control must be enough to change your mind',
    ).toHaveText(/leave me out|do not count/i, { timeout: 20_000 });

    expect(nativeDialog, 'changing your mind must not raise a browser confirmation').toBeNull();
    expect(
      await page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible, dialog[open]').count(),
      'changing your mind must not open a confirmation dialog',
    ).toBe(0);

    expect((await serverObjection()).objected, 'the withdrawal reached the server').toBe(false);
  });

  test('answers are PRIVATE on the public profile until a field opts in', async ({ page: stranger }) => {
    test.skip(flags.persona !== true, 'features.persona is off on this instance');

    // The load-bearing inversion. No built-in field sets `showOnProfile: true`,
    // so a default instance publishes nothing however much a member fills in,
    // and the answers saved by the first test in this file must not appear.
    // Asserted from BOTH sides, because "the stranger cannot see it" and "the
    // owner is told why" are different failures.
    for (const [who, page] of [['owner', member.page], ['stranger', stranger]] as const) {
      await page.goto(`/u/${member.username}`);
      await expect(async () => {
        await page.getByRole('button', { name: 'About' }).click();
        // The About tab itself has to be reachable before anything below means
        // anything; a click swallowed before hydration would make every
        // negative assertion pass against a page that never opened.
        await expect(page.locator('.cpub-about-grid')).toBeVisible({
          timeout: 3000,
        });
      }).toPass({ timeout: 45_000 });

      await expect(
        page.locator('.cpub-persona-public'),
        `${who} must not see a published answer block on a default instance`,
      ).toHaveCount(0);

      for (const pick of PICKED) {
        await expect(
          page.locator('body'),
          `${who} can see the answer ${pick.label}, which nothing opted in`,
        ).not.toContainText(pick.label);
      }
    }

    // The owner is told WHY the section is empty, and is not nagged to fill in
    // something they already filled in.
    await expect(
      member.page.locator('.cpub-persona-public-owner-note'),
      'the owner is told their answers are private, not that they are missing',
    ).toContainText('private');
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

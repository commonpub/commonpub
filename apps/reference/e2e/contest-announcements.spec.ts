import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { dismissCookieBanner } from './helpers/consent';

/**
 * Contest announcements — the organizer "message participants" flow, end to end.
 *
 * Why this exists rather than only unit tests: the send button sits behind a
 * block editor, a debounced recipient count, a sandboxed preview iframe and a
 * confirm step, and every one of those is a seam a unit test cannot reach. The
 * unit suites can prove the audience SQL and the template; only this can prove
 * that what an organizer actually clicks results in queued mail.
 *
 * Shape, matching contest-lifecycle.spec.ts: the API does setup and verifies
 * stored state; the browser drives everything the organizer clicks.
 *
 * Requires `contests` + `contestBroadcast` + `emailNotifications`. It also wants
 * `emailUnverified`, because a freshly signed-up participant has an unconfirmed
 * address and would otherwise be correctly excluded from every audience.
 */

const S = Date.now();
const uniq = (p: string): string => `${p}${S}`.slice(0, 24);

interface Persona { username: string; ctx: BrowserContext; page: Page }

let BASE: string;
let ORIGIN: Record<string, string>;
let slug: string;
let organizer: Persona;
const participants: Persona[] = [];

async function makePersona(browser: Browser, handle: string): Promise<Persona> {
  const ctx = await browser.newContext();
  await dismissCookieBanner(ctx, BASE);
  const username = uniq(handle);
  const res = await ctx.request.post(`${BASE}/api/auth/sign-up/email`, {
    headers: ORIGIN,
    data: { email: `${handle}-${S}@example.com`, password: 'Password123!', username, name: handle },
  });
  expect(res.ok(), `sign-up ${handle}: ${res.status()}`).toBeTruthy();
  return { username, ctx, page: await ctx.newPage() };
}

test.describe.configure({ mode: 'serial' });

test.describe('contest announcements', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    BASE = baseURL!;
    ORIGIN = { origin: BASE };

    const flags = await (await fetch(`${BASE}/api/features`)).json();
    test.skip(!flags.contestBroadcast, 'contestBroadcast is off on this instance');

    organizer = await makePersona(browser, 'annorg');
    const now = Date.now();
    const iso = (t: number): string => new Date(t).toISOString();
    const created = await organizer.ctx.request.post(`${BASE}/api/contests`, {
      headers: ORIGIN,
      data: {
        title: `Announcement Cup ${S}`,
        subheading: 'Verifying the organizer announcement flow.',
        description: 'A contest that exists to be emailed about.',
        startDate: iso(now - 864e5),
        endDate: iso(now + 20 * 864e5),
        judgingEndDate: iso(now + 30 * 864e5),
        status: 'active',
      },
    });
    expect(created.ok(), `create contest: ${created.status()} ${await created.text()}`).toBeTruthy();
    slug = (await created.json()).slug;

    // Two registrants: one full participant, one reminders-only, so the tier
    // filter has something real to distinguish.
    for (const [handle, tier] of [['annfull', 'full'], ['annrem', 'reminders']] as const) {
      const p = await makePersona(browser, handle);
      const reg = await p.ctx.request.post(`${BASE}/api/contests/${slug}/register`, {
        headers: ORIGIN,
        data: { tier },
      });
      expect(reg.ok(), `register ${handle}: ${reg.status()} ${await reg.text()}`).toBeTruthy();
      participants.push(p);
    }
  });

  test.afterAll(async () => {
    for (const p of [organizer, ...participants]) await p?.ctx.close();
  });

  test('the recipient count matches the audience, and narrows with the tier', async () => {
    const count = async (tier: string): Promise<number> => {
      const res = await organizer.ctx.request.post(`${BASE}/api/contests/${slug}/announcements/recipients`, {
        headers: ORIGIN,
        data: { kind: 'registrants', tier },
      });
      expect(res.ok(), `recipients ${tier}: ${res.status()} ${await res.text()}`).toBeTruthy();
      return (await res.json()).count;
    };
    expect(await count('all')).toBe(2);
    expect(await count('full')).toBe(1);
    expect(await count('reminders')).toBe(1);
  });

  test('a participant cannot read the audience, send, or see the history', async () => {
    const p = participants[0]!;
    for (const [path, data] of [
      ['announcements/recipients', { kind: 'registrants', tier: 'all' }],
      ['announcements/preview', { subject: 'x', bodyBlocks: [] }],
    ] as const) {
      const res = await p.ctx.request.post(`${BASE}/api/contests/${slug}/${path}`, { headers: ORIGIN, data });
      expect(res.status(), path).toBe(403);
    }
    const hist = await p.ctx.request.get(`${BASE}/api/contests/${slug}/announcements`);
    expect(hist.status()).toBe(403);
    const send = await p.ctx.request.post(`${BASE}/api/contests/${slug}/announcements`, {
      headers: ORIGIN,
      data: { subject: 'Hijack', bodyBlocks: [['paragraph', { text: 'hi' }]], audience: { kind: 'registrants' }, idempotencyKey: `evil-${S}` },
    });
    expect(send.status()).toBe(403);
  });

  test('an anonymous request cannot reach any announcement route', async ({ request }) => {
    const res = await request.post(`${BASE}/api/contests/${slug}/announcements/recipients`, {
      headers: ORIGIN,
      data: { kind: 'registrants', tier: 'all' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('the organizer composes and sends from the editor, and it reaches the audience', async () => {
    const page = organizer.page;
    await page.goto(`${BASE}/contests/${slug}/edit`);

    const tab = page.getByRole('tab', { name: /Announcements/i });
    await expect(tab).toBeVisible({ timeout: 30_000 });
    await tab.click();

    // The audience picker, with a live count resolved from the server.
    await expect(page.getByRole('radiogroup', { name: /Who gets this/i })).toBeVisible();
    await expect(page.getByText(/2\s+people will receive this/i)).toBeVisible({ timeout: 15_000 });

    // Narrowing the audience re-counts.
    await page.getByRole('radio', { name: /Full participants only/i }).click();
    await expect(page.getByText(/1\s+person will receive this/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('radio', { name: /Everyone registered/i }).click();
    await expect(page.getByText(/2\s+people will receive this/i)).toBeVisible({ timeout: 15_000 });

    // Compose.
    const subject = page.getByPlaceholder('An update on {contestTitle}');
    await subject.fill('Kickoff for {contestTitle}');

    // The preview renders server-side into a sandboxed iframe.
    const frame = page.locator('iframe[title="Announcement preview"]');
    await expect(frame).toBeVisible({ timeout: 15_000 });
    await expect(frame).toHaveAttribute('sandbox', '');
    // The preview is a REAL rendered email, not a mock: `{username}` resolved to
    // the viewer, and the CTA href is ABSOLUTE. A root-relative href would look
    // fine in this iframe and land on a bogus host in an inbox.
    const srcdoc = async (): Promise<string> => (await frame.getAttribute('srcdoc')) ?? '';
    await expect.poll(srcdoc, { timeout: 15_000 }).toContain(`Hi ${organizer.username},`);
    expect(await srcdoc()).toContain(`${BASE}/contests/${slug}`);
    expect(await srcdoc(), 'a root-relative href reached the email').not.toMatch(/href="\/[^/]/);
    // System chrome the organizer cannot remove.
    expect(await srcdoc()).toContain('View the contest');
    expect(await srcdoc()).toContain('Unsubscribe');

    await page.screenshot({ path: 'contest-announcement-screens/composer-desktop.png', fullPage: true });

    // Sending takes two deliberate clicks, never one.
    await page.getByRole('button', { name: /Send to participants/i }).click();
    await expect(page.getByText(/cannot be undone/i)).toBeVisible();
    await page.screenshot({ path: 'contest-announcement-screens/confirm-desktop.png' });
    await page.getByRole('button', { name: /Yes, send it/i }).click();

    await expect(page.getByText(/sent to 2 people/i)).toBeVisible({ timeout: 20_000 });

    // The history records it, without leaking any recipient identity.
    const hist = await organizer.ctx.request.get(`${BASE}/api/contests/${slug}/announcements`);
    expect(hist.ok()).toBeTruthy();
    const rows = await hist.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ subject: 'Kickoff for {contestTitle}', recipientCount: 2, status: 'sent' });
    expect(JSON.stringify(rows)).not.toContain('@example.com');

    await page.screenshot({ path: 'contest-announcement-screens/history-desktop.png', fullPage: true });
  });

  test('a repeated idempotency key mails nobody a second time', async () => {
    const key = `dup-${S}`;
    const body = {
      subject: 'Duplicate guard',
      bodyBlocks: [['paragraph', { text: 'Once only.' }]],
      audience: { kind: 'registrants', tier: 'all' },
      idempotencyKey: key,
    };
    const first = await organizer.ctx.request.post(`${BASE}/api/contests/${slug}/announcements`, { headers: ORIGIN, data: body });
    expect(first.ok(), `${first.status()} ${await first.text()}`).toBeTruthy();
    const a = await first.json();
    expect(a.duplicate).toBe(false);
    expect(a.recipientCount).toBe(2);

    const second = await organizer.ctx.request.post(`${BASE}/api/contests/${slug}/announcements`, { headers: ORIGIN, data: body });
    expect(second.ok()).toBeTruthy();
    const b = await second.json();
    expect(b.duplicate).toBe(true);
    expect(b.announcementId).toBe(a.announcementId);
  });

  test('the composer works at phone width', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await organizer.ctx.storageState(),
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/contests/${slug}/edit`);
    const tab = page.getByRole('tab', { name: /Announcements/i });
    await expect(tab).toBeVisible({ timeout: 30_000 });
    await tab.click();
    await expect(page.getByRole('radiogroup', { name: /Who gets this/i })).toBeVisible();

    // Nothing may push the page wider than the phone. A horizontal scrollbar on
    // a compose form is the classic sign of an un-wrapped grid column.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page scrolls horizontally at 390px').toBeLessThanOrEqual(1);

    await page.screenshot({ path: 'contest-announcement-screens/composer-mobile.png', fullPage: true });
    await ctx.close();
  });
});

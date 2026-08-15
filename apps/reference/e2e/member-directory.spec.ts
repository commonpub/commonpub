import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { readFeatures, signIn, signUp, type E2EAccount } from './helpers/account';

/**
 * The opt-in member visibility directory, end to end.
 *
 * `GET /api/public/v1/members/open-to/{audience}` is the only public surface in
 * this codebase that returns IDENTIFIED people rather than k-anonymous counts.
 * Four properties are worth a browser, and none of them can be settled by a
 * unit test:
 *
 *  1. with `features.memberDirectory` off, the endpoint does not exist;
 *  2. a member who has not opted in is not in it;
 *  3. a member who has opted in is, and the serialised body carries no email
 *     address anywhere, asserted on the bytes rather than on the type;
 *  4. the member can then see, on their own privacy page, which recipient
 *     looked at them.
 *
 * ---------------------------------------------------------------------------
 * WHAT BLOCKS THE FULL WALK IN CI, PRECISELY
 * ---------------------------------------------------------------------------
 * Properties 2 to 4 need an API key that holds `read:members` AND carries a
 * `recipient_id` binding. Minting one needs the `apikeys.manage` permission,
 * which only an admin holds, and NO admin account can exist in a CI e2e run:
 *
 *  - the CI job creates a fresh database and never runs `scripts/seed.ts`;
 *  - `scripts/seed.ts` writes `users` rows with no better-auth credential rows,
 *    so even a seeded admin cannot log in;
 *  - nothing in the app promotes the first registered user to admin;
 *  - a session cookie cannot be forged, because better-auth signs it.
 *
 * So those tests SKIP unless the operator supplies a way in. Two are accepted,
 * both read once in `beforeAll`:
 *
 *  - `E2E_DIRECTORY_KEY` (plus optional `E2E_DIRECTORY_WILDCARD_KEY` and
 *    `E2E_DIRECTORY_UNBOUND_KEY`): tokens minted by hand at /admin/api-keys;
 *  - `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`: an existing admin login, from
 *    which this spec mints its own keys through the same admin API the admin UI
 *    calls, and deletes them again in `afterAll`.
 *
 * The instance also has to be configured for the feature at all: `publicApi`,
 * `persona`, `dataSharingConsents` and `memberDirectory` on, plus a recipient
 * declared in `dataSharing.recipients` whose `purposes` include
 * `recruiter_visibility`. Without a recipient nothing is offerable, by design
 * (`purposeIsOfferable`), so there is nothing for a member to opt in to. Every
 * test below derives its own skip from live state rather than assuming any of
 * that, and test 1 runs unconditionally in both directions.
 */

const AUDIENCE = 'recruiters';
const DIRECTORY_PATH = `/api/public/v1/members/open-to/${AUDIENCE}`;
/** The purpose the recruiter audience maps to (plan section 4). */
const DIRECTORY_PURPOSE = 'recruiter_visibility';

/**
 * Anything shaped like an email address, wherever it appears in a payload.
 *
 * The last label has to be LETTERS. Without that, `h3@1.15.10` out of a dev
 * server's stack trace reads as an address and the scan cries wolf on every
 * error page, which is how a real assertion gets deleted for being noisy.
 */
const EMAIL_SHAPED = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}/;

interface PurposeSummary {
  id: string;
  label: string;
  onSummary: string;
  offSummary: string;
  state: string;
  needsReconfirmation: boolean;
  recipients: Array<{ id: string; name: string }>;
}

let BASE: string;
let flags: Record<string, boolean>;
let member: E2EAccount;
let admin: E2EAccount | null = null;
/** Keys this spec minted itself, so `afterAll` can take them away again. */
const mintedKeyIds: string[] = [];

/** A `read:members` key bound to a recipient. Null when nothing supplied one. */
let boundKey: string | null = null;
/** A `read:*` key, for the wildcard refusal. */
let wildcardKey: string | null = null;
/** A `read:members` key with NO recipient binding, for the 403. */
let unboundKey: string | null = null;
/** The recipient the bound key belongs to, as a member would read it. */
let recipientName: string | null = null;

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The "who has looked at you" block on /settings/privacy, addressed by its own
 * heading rather than by a class, so the assertion survives a restyle and fails
 * loudly if the section is missing altogether.
 */
function disclosureSection(page: Page): Locator {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /who has (looked|seen)/i }) });
}

async function getDirectory(
  request: APIRequestContext,
  token: string | null,
  query = '',
): Promise<{ status: number; raw: string; body: unknown }> {
  const res = await request.get(`${BASE}${DIRECTORY_PATH}${query}`, {
    headers: token ? bearer(token) : undefined,
  });
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* an error page is not JSON, and the raw text is what the assertions read */
  }
  return { status: res.status(), raw, body };
}

/** Every key of every object in a payload, however deep. */
function deepKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) deepKeys(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(k);
      deepKeys(v, out);
    }
  }
  return out;
}

/** The purposes this instance currently offers THIS member. */
async function offeredPurposes(): Promise<PurposeSummary[]> {
  const res = await member.ctx.request.get(`${BASE}/api/consent/purposes`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { purposes?: PurposeSummary[] };
  return body.purposes ?? [];
}

async function directoryPurpose(): Promise<PurposeSummary | null> {
  return (await offeredPurposes()).find((p) => p.id === DIRECTORY_PURPOSE) ?? null;
}

/**
 * Mint a key through the same admin API the key screen calls.
 *
 * `recipientId` is sent whether or not `createApiKeySchema` has learned the
 * field: a Zod object strips what it does not declare, so an instance whose
 * schema has not caught up returns an UNBOUND key rather than an error. That is
 * why `beforeAll` probes the minted key instead of trusting it, and why the
 * skip message names the binding.
 */
async function mintKey(
  scopes: string[],
  recipientId?: string,
): Promise<string | null> {
  if (!admin) return null;
  const res = await admin.ctx.request.post(`${BASE}/api/admin/api-keys`, {
    headers: { origin: BASE },
    data: {
      name: `e2e directory ${scopes.join(' ')} ${Date.now()}`,
      scopes,
      ...(recipientId ? { recipientId } : {}),
    },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { token?: string; key?: { id?: string; token?: string } };
  const id = body.key?.id;
  if (id) mintedKeyIds.push(id);
  return body.token ?? body.key?.token ?? null;
}

test.describe('Member visibility directory', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.skip(({ browserName }) => browserName !== 'chromium', 'directory walk runs on chromium only');

  test.beforeAll(async ({ browser }) => {
    BASE = test.info().project.use.baseURL ?? 'http://localhost:3000';
    member = await signUp(browser, BASE, 'directory');
    flags = await readFeatures(member.ctx, BASE);

    boundKey = process.env.E2E_DIRECTORY_KEY ?? null;
    wildcardKey = process.env.E2E_DIRECTORY_WILDCARD_KEY ?? null;
    unboundKey = process.env.E2E_DIRECTORY_UNBOUND_KEY ?? null;

    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    if (!boundKey && adminEmail && adminPassword) {
      admin = await signIn(browser, BASE, adminEmail, adminPassword);
      const recipient = (await directoryPurpose())?.recipients[0] ?? null;
      if (recipient) {
        boundKey = await mintKey(['read:members'], recipient.id);
      }
      wildcardKey ??= await mintKey(['read:*']);
      unboundKey ??= await mintKey(['read:members']);
    }

    recipientName = (await directoryPurpose())?.recipients[0]?.name ?? null;

    // Probe rather than trust. A key that exists but is not bound answers 403,
    // and a spec that then "passed" its absence test would be measuring the
    // binding failure, not the consent join.
    //
    // The probe searches for this run's own username, which nobody has opted in
    // as yet, so setup discloses no real member and writes no disclosure row
    // that a later assertion would have to explain away.
    if (boundKey && flags.memberDirectory === true) {
      const probe = await getDirectory(
        member.ctx.request,
        boundKey,
        `?q=${encodeURIComponent(member.username)}`,
      );
      if (probe.status !== 200) {
        test.info().annotations.push({
          type: 'directory-key',
          description: `bound key rejected with ${probe.status}: ${probe.raw.slice(0, 200)}`,
        });
        boundKey = null;
      }
    }
  });

  test.afterAll(async () => {
    for (const id of mintedKeyIds) {
      await admin?.ctx.request.delete(`${BASE}/api/admin/api-keys/${id}`, { headers: { origin: BASE } })
        .catch(() => { /* the run is over; a stray test key is not worth failing on */ });
    }
    await admin?.close();
    await member?.close();
  });

  /**
   * Runs in BOTH directions, unconditionally, because the off direction is the
   * one that ships broken: a surface that exists on an instance whose operator
   * never opted in is the whole risk this flag exists to remove.
   */
  test('the directory does not exist unless the operator turned it on', async ({ request }) => {
    const anonymous = await getDirectory(request, null);

    expect(anonymous.status, 'the directory never answers an unauthenticated caller').not.toBe(200);
    expect(anonymous.raw, 'not even an error page may carry an address').not.toMatch(EMAIL_SHAPED);

    if (flags.publicApi !== true) {
      // The whole public family is hidden, so its existence is not even
      // confirmable. This is the reference app's shipped default.
      expect(anonymous.status, 'with publicApi off the surface is a 404').toBe(404);
    } else {
      // The key middleware runs before the route, so a keyless caller cannot
      // tell a missing feature from a missing key. Both are refusals.
      expect([401, 403, 404]).toContain(anonymous.status);
    }

    if (flags.memberDirectory !== true && boundKey) {
      const withKey = await getDirectory(request, boundKey);
      expect(
        withKey.status,
        'with the feature off, even a valid key must be told the surface is not there',
      ).toBe(404);
    }
  });

  test('the directory is not filed under the metrics family', async ({ request }) => {
    test.skip(flags.publicApi !== true, 'publicApi is off, so every path under it answers alike');
    test.skip(!boundKey, 'needs a read:members key; see the header note on what blocks minting one');

    // A people lister under a metrics prefix is a category error that invites
    // someone to hand it a metrics key (plan section 4). Assert the wrong
    // shapes are absent rather than trusting that nobody adds them later.
    for (const wrong of [
      `/api/public/v1/metrics/members/open-to/${AUDIENCE}`,
      `/api/public/v1/metrics/persona/members`,
    ]) {
      const res = await request.get(`${BASE}${wrong}`, { headers: bearer(boundKey!) });
      expect(res.status(), `${wrong} must not be a people lister`).toBe(404);
    }
  });

  test('the consent a member is asked for names the deal, and starts off', async () => {
    const purpose = await directoryPurpose();
    test.skip(
      purpose === null,
      `${DIRECTORY_PURPOSE} is not offered here: needs dataSharingConsents on and a recipient covering it in dataSharing.recipients`,
    );

    expect(purpose!.state, 'nothing is opted in to by default').not.toBe('granted');
    // The promise the product is built on has to be in the sentence the member
    // reads, not only in a plan. Both halves matter: no address, and contact
    // stays on this site.
    expect(purpose!.onSummary).toMatch(/cannot see your email address/i);
    expect(purpose!.onSummary).toMatch(/messages on this site/i);
    expect(purpose!.recipients.length, 'a named recipient is what makes this offerable').toBeGreaterThan(0);
  });

  test('a member who has not opted in is absent from the directory', async ({ request }) => {
    test.skip(flags.memberDirectory !== true, 'features.memberDirectory is off on this instance');
    test.skip(!boundKey, 'needs a read:members key bound to a recipient; see the header note');

    // Scoped by `q` so the assertion cannot be satisfied by pagination: on an
    // instance with 60 consenting members, "not on page one" is not "absent".
    //
    // This test cannot pass vacuously against an endpoint that always answers
    // empty, because the NEXT test issues the identical request after the grant
    // and requires the member back. The pair is the assertion; neither half is.
    const { status, body } = await getDirectory(
      request,
      boundKey,
      `?q=${encodeURIComponent(member.username)}`,
    );
    expect(status).toBe(200);
    const items = (body as { items: Array<{ username: string }> }).items;
    expect(Array.isArray(items), 'the directory answers with a page').toBe(true);
    expect(
      items.map((i) => i.username),
      'a member who never agreed to anything must not be listed',
    ).not.toContain(member.username);
  });

  test('after opting in the member appears, and no email address is anywhere in the body', async ({ request }) => {
    test.skip(flags.memberDirectory !== true, 'features.memberDirectory is off on this instance');
    test.skip(!boundKey, 'needs a read:members key bound to a recipient; see the header note');
    const purpose = await directoryPurpose();
    test.skip(purpose === null, `${DIRECTORY_PURPOSE} is not offered on this instance`);

    // Opt in the way a member does: on their own privacy page, one click.
    const { page } = member;
    await page.goto('/settings/privacy');
    await page.waitForSelector('.cpub-privacy-settings', { timeout: 30_000 });
    const control = page.getByRole('switch', { name: new RegExp(escapeRegExp(purpose!.label), 'i') });
    await expect(control, 'the directory consent is on the privacy page').toBeVisible();
    await expect(async () => {
      if ((await control.getAttribute('aria-checked')) !== 'true') await control.click();
      await expect(control).toHaveAttribute('aria-checked', 'true', { timeout: 1500 });
    }).toPass({ timeout: 45_000 });
    expect((await directoryPurpose())?.state, 'the grant reached the server').toBe('granted');

    const { status, raw, body } = await getDirectory(
      request,
      boundKey,
      `?q=${encodeURIComponent(member.username)}`,
    );
    expect(status).toBe(200);
    const items = (body as { items: Array<{ username: string }> }).items;
    expect(
      items.map((i) => i.username),
      'a member who opted in is listed',
    ).toContain(member.username);

    // D4: email is structurally absent. Assert on the BYTES, because a type
    // that omits a field proves nothing about a serializer that adds one.
    expect(raw, 'this member address must not appear').not.toContain(member.email);
    expect(raw, 'nothing email-shaped may appear at all').not.toMatch(EMAIL_SHAPED);
    const keys = deepKeys(body).map((k) => k.toLowerCase());
    expect(keys.length, 'the payload has to have been walked').toBeGreaterThan(0);
    expect(
      keys.filter((k) => k.includes('email')),
      'no field in the payload may be named for an address',
    ).toEqual([]);
  });

  test('a read:* key does not reach the directory, and neither does an unbound one', async ({ request }) => {
    test.skip(flags.memberDirectory !== true, 'features.memberDirectory is off on this instance');
    test.skip(
      !wildcardKey && !unboundKey,
      'needs a read:* and/or an unbound read:members key; see the header note',
    );

    if (wildcardKey) {
      const res = await getDirectory(request, wildcardKey);
      expect(
        res.status,
        'read:* must not silently pick up the one scope that returns identified people',
      ).toBe(403);
      expect(res.raw).not.toMatch(EMAIL_SHAPED);
    }
    if (unboundKey) {
      const res = await getDirectory(request, unboundKey);
      expect(
        res.status,
        'a key with no recipient binding has nobody to attribute a disclosure to',
      ).toBe(403);
    }
  });

  test('the member can see which recipient looked at them', async () => {
    test.skip(flags.memberDirectory !== true, 'features.memberDirectory is off on this instance');
    test.skip(!boundKey, 'needs a read:members key bound to a recipient; see the header note');
    test.skip(!recipientName, 'no named recipient resolved from the offered purpose');

    const { page } = member;
    await page.goto('/settings/privacy');
    await page.waitForSelector('.cpub-privacy-settings', { timeout: 30_000 });

    // Scoped to the disclosure section on purpose. Every recipient name also
    // appears in the purpose card's own "Shared with" list, so a page-wide
    // `toContainText` would pass without a single disclosure ever happening.
    const section = disclosureSection(page);
    await expect(
      section,
      'the accountability record is worth more to the member than to the operator (D6)',
    ).toBeVisible({ timeout: 20_000 });
    await expect(section, 'the recipient that pulled the page is named').toContainText(recipientName!);
    await expect(
      section,
      'the copy must not imply that revoking recalls what was already shared',
    ).toContainText(/already shared|cannot recall|cannot take back/i);
  });
});

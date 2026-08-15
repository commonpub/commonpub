/**
 * Behavioural tests for `GET /api/consent/disclosures` (directory plan D6).
 *
 * The REAL handler, against a REAL (PGlite) database, through the REAL
 * `listDisclosuresForMember` and `effectiveRecipients` from
 * `packages/server/src/persona/`. Nothing about the grouping is simulated: the
 * counts asserted below are counts Postgres produced from rows it holds.
 * `requireFeature` is the actual implementation from
 * `layers/base/server/utils/validate.ts`, so the 404 is the one a client sees.
 *
 * The assertion that matters most is the one about the query string. This route
 * answers "who has read MY row", and the only thing standing between that and
 * "who has read anyone's row" is that the handler takes its user id from the
 * session and there is no parameter to take it from instead. A test that only
 * checked the happy path would pass just as well against a handler that read
 * `?userId=`, which is why the requests below carry one.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { H3Event } from 'h3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { disclosureEvents } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../../packages/server/src/types';

vi.mock('@commonpub/server', async () => {
  const [directory, recipients] = await Promise.all([
    import('../../../../../../packages/server/src/persona/directory'),
    import('../../../../../../packages/server/src/persona/recipients'),
  ]);
  return { ...directory, ...recipients };
});

interface HttpError extends Error {
  statusCode: number;
  statusMessage?: string;
}

interface TestConfig {
  features: Record<string, boolean>;
  dataSharing?: unknown;
}

let db: DB;
let currentUser: { id: string } | null = null;
let testConfig: TestConfig;
/** What the handler would see if it ever read the query string. It must not. */
let requestQuery: Record<string, string> = {};

{
  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (fn: unknown): unknown => fn;
  g.createError = (opts: { statusCode: number; statusMessage?: string }): HttpError => {
    const e = new Error(opts.statusMessage ?? 'Error') as HttpError;
    e.statusCode = opts.statusCode;
    e.statusMessage = opts.statusMessage;
    return e;
  };
  g.requireAuth = (): { id: string } => {
    if (!currentUser) {
      const e = new Error('Not logged in') as HttpError;
      e.statusCode = 401;
      throw e;
    }
    return currentUser;
  };
  g.useDB = (): DB => db;
  g.useConfig = (): CommonPubConfig => testConfig as unknown as CommonPubConfig;
  g.getQuery = (): Record<string, string> => requestQuery;
}

const validate = await import('../../../utils/validate');
{
  (globalThis as Record<string, unknown>).requireFeature = validate.requireFeature;
}

const mod = await import('../disclosures.get');
const handler = mod.default as (event: H3Event) => Promise<DisclosuresPayload>;

interface DisclosureRow {
  recipientId: string;
  recipientName: string;
  recipientKnown: boolean;
  purposes: string[];
  count: number;
  lastDisclosedAt: string;
}
interface DisclosuresPayload {
  disclosures: DisclosureRow[];
}

const fakeEvent = { method: 'GET', path: '/api/consent/disclosures' } as unknown as H3Event;

const ACME = {
  id: 'acme',
  name: 'Acme Robotics',
  privacyPolicyUrl: 'https://acme.example/privacy',
  purposes: ['recruiter_visibility'],
  relationship: 'independent_controller',
  agreementRef: 'https://acme.example/dpa',
};

function failure(p: Promise<unknown>): Promise<HttpError> {
  return p.then(
    () => {
      throw new Error('expected the handler to throw, it resolved');
    },
    (e: HttpError) => e,
  );
}

async function disclose(
  userId: string,
  recipientId: string,
  when: string,
  purpose = 'recruiter_visibility',
): Promise<void> {
  await db.insert(disclosureEvents).values({
    recipientId,
    userId,
    purpose,
    scopeDigest: 'abcdef0123456789',
    disclosedAt: new Date(when),
  });
}

beforeAll(async () => {
  db = await createTestDB();
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
});

beforeEach(async () => {
  testConfig = {
    features: { memberDirectory: true, dataSharingConsents: true },
    dataSharing: { recipients: [ACME] },
  };
  currentUser = null;
  requestQuery = {};
  await db.delete(disclosureEvents);
});

describe('the gates', () => {
  it('is 404, not 403, when memberDirectory is off', async () => {
    testConfig.features.memberDirectory = false;
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const err = await failure(handler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });

  it('is 401 when nobody is logged in', async () => {
    currentUser = null;
    const err = await failure(handler(fakeEvent));
    expect(err.statusCode).toBe(401);
  });

  it('checks the flag BEFORE the session, so a logged-out probe cannot tell the surface exists', async () => {
    testConfig.features.memberDirectory = false;
    currentUser = null;
    const err = await failure(handler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });
});

describe('scoping', () => {
  it('reports the SESSION user and ignores a user id in the query string', async () => {
    const me = await createTestUser(db);
    const someoneElse = await createTestUser(db);
    await disclose(someoneElse.id, 'acme', '2026-08-04T10:00:00.000Z');

    currentUser = { id: me.id };
    // Every plausible spelling of "read someone else's record".
    requestQuery = {
      userId: someoneElse.id,
      user_id: someoneElse.id,
      user: someoneElse.id,
      id: someoneElse.id,
    };

    const payload = await handler(fakeEvent);
    expect(payload.disclosures).toEqual([]);

    // Guard: the other user's row really is there, so the empty result above is
    // scoping and not an empty table.
    currentUser = { id: someoneElse.id };
    const theirs = await handler(fakeEvent);
    expect(theirs.disclosures).toHaveLength(1);
  });

  it('takes no user id from the source at all', () => {
    // A parameter validated against the session is one refactor away from being
    // validated against nothing. This asserts there is no parameter.
    const src = readFileSync(resolve(__dirname, '..', 'disclosures.get.ts'), 'utf8');
    expect(src.length).toBeGreaterThan(1500); // guard: a wrong path reads nothing
    const code = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/*'))
      .join('\n');
    expect(code).not.toMatch(/getQuery|getRouterParam|readBody|parseQueryParams|parseParams/);
    expect(code).toContain('requireAuth(event)');
  });
});

describe('the payload', () => {
  it('groups by recipient, sums the count and reports the most recent time', async () => {
    const me = await createTestUser(db);
    currentUser = { id: me.id };
    await disclose(me.id, 'acme', '2026-08-01T09:00:00.000Z');
    await disclose(me.id, 'acme', '2026-08-03T09:00:00.000Z');
    await disclose(me.id, 'acme', '2026-08-04T09:00:00.000Z');

    const payload = await handler(fakeEvent);
    expect(payload.disclosures).toHaveLength(1);
    expect(payload.disclosures[0]).toMatchObject({
      recipientId: 'acme',
      recipientName: 'Acme Robotics',
      recipientKnown: true,
      count: 3,
      lastDisclosedAt: '2026-08-04T09:00:00.000Z',
    });
  });

  it('folds two purposes for one recipient into one row and keeps both purposes', async () => {
    const me = await createTestUser(db);
    currentUser = { id: me.id };
    await disclose(me.id, 'acme', '2026-08-01T09:00:00.000Z', 'sponsor_sharing');
    await disclose(me.id, 'acme', '2026-08-05T09:00:00.000Z', 'recruiter_visibility');

    const payload = await handler(fakeEvent);
    expect(payload.disclosures).toHaveLength(1);
    expect(payload.disclosures[0]!.count).toBe(2);
    expect(payload.disclosures[0]!.purposes).toEqual([
      'recruiter_visibility',
      'sponsor_sharing',
    ]);
    expect(payload.disclosures[0]!.lastDisclosedAt).toBe('2026-08-05T09:00:00.000Z');
  });

  it('orders recipients most recent first', async () => {
    const me = await createTestUser(db);
    currentUser = { id: me.id };
    testConfig.dataSharing = {
      recipients: [ACME, { ...ACME, id: 'contoso', name: 'Contoso Tools' }],
    };
    await disclose(me.id, 'acme', '2026-08-01T09:00:00.000Z');
    await disclose(me.id, 'contoso', '2026-08-09T09:00:00.000Z');

    const payload = await handler(fakeEvent);
    expect(payload.disclosures.map((d) => d.recipientId)).toEqual(['contoso', 'acme']);
  });

  it('still reports a disclosure whose recipient the operator has since removed', async () => {
    // `disclosure_events.recipient_id` is deliberately not a foreign key. An
    // operator deleting a recipient withdraws the disclosure going forward; it
    // must not delete the evidence that one already happened.
    const me = await createTestUser(db);
    currentUser = { id: me.id };
    await disclose(me.id, 'ghost', '2026-08-04T09:00:00.000Z');

    const payload = await handler(fakeEvent);
    expect(payload.disclosures).toHaveLength(1);
    expect(payload.disclosures[0]).toMatchObject({
      recipientId: 'ghost',
      recipientName: 'ghost',
      recipientKnown: false,
      count: 1,
    });
  });

  it('resolves a recipient the operator declared in the database rather than the file', async () => {
    const me = await createTestUser(db);
    currentUser = { id: me.id };
    testConfig.dataSharing = { recipients: [] };
    const { setStoredRecipients } = await import(
      '../../../../../../packages/server/src/persona/recipients'
    );
    const admin = await createTestUser(db);
    const result = await setStoredRecipients(db, admin.id, [
      { ...ACME, id: 'db-only', name: 'Database Recipient' },
    ]);
    expect(result.ok).toBe(true);

    await disclose(me.id, 'db-only', '2026-08-04T09:00:00.000Z');
    const payload = await handler(fakeEvent);
    expect(payload.disclosures[0]).toMatchObject({
      recipientName: 'Database Recipient',
      recipientKnown: true,
    });
  });

  it('returns an empty list, never a fabricated row, when nobody has looked', async () => {
    const me = await createTestUser(db);
    currentUser = { id: me.id };
    const payload = await handler(fakeEvent);
    expect(payload.disclosures).toEqual([]);
  });

  it('carries no email address anywhere in the serialised payload', async () => {
    const me = await createTestUser(db, { email: 'leak-probe@example.com' });
    currentUser = { id: me.id };
    await disclose(me.id, 'acme', '2026-08-04T09:00:00.000Z');
    const payload = await handler(fakeEvent);
    expect(JSON.stringify(payload)).not.toContain('leak-probe@example.com');
    expect(JSON.stringify(payload)).not.toContain('@');
  });
});

/**
 * Behavioural tests for `GET /api/consent/purposes` and `PUT /api/consent/purposes`.
 *
 * These drive the REAL route handlers against a REAL (PGlite) database, through
 * the REAL `recordPurposeConsent` / `currentPurposeScope` / `effectivePersonaSchema`
 * from `packages/server/src/persona/`. Nothing about the consent write is
 * simulated: the rows asserted below are rows Postgres actually holds, under the
 * real partial unique index. The Nitro auto-imports are stubbed with their REAL
 * semantics (`requireFeature` and `parseBody` are the actual implementations
 * imported from `layers/base/server/utils/validate.ts`, so the 404 and the 400
 * body shape are the ones a client really sees).
 *
 * ONE thing is faked, and it is the gap this build depends on another agent to
 * close: `@commonpub/server` does not yet re-export `PROCESSING_PURPOSE_SPECS`
 * from `@commonpub/persona`. The layer cannot import `@commonpub/persona`
 * directly (it is deliberately not a dependency of `@commonpub/layer`, plan
 * 14.3), and `revocationEffect` exists nowhere else, so the route reads it from
 * `@commonpub/server` and the module mock below supplies it from the real
 * registry. `purposes-contract.test.ts` carries a guard that fails red until the
 * one-line re-export lands, so this is loud rather than silent.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { H3Event } from 'h3';
import { and, eq, isNull } from 'drizzle-orm';
import { userPurposeConsents } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../../packages/server/src/types';

vi.mock('@commonpub/server', async () => {
  const [consent, registry, recipients, persona] = await Promise.all([
    import('../../../../../../packages/server/src/persona/consent'),
    import('../../../../../../packages/server/src/persona/registry'),
    // The real recipients module, against the real PGlite database. The GET
    // route resolves its scope with `dataSharing: effectiveDataSharingDocument`
    // so the digest covers the file list UNION the stored one; stubbing it here
    // would let the file-only digest regression back in unseen.
    import('../../../../../../packages/server/src/persona/recipients'),
    import('../../../../../../packages/persona/src/index'),
  ]);
  return {
    ...registry,
    ...recipients,
    ...consent,
    // Pure-brain values the routes reach through the server barrel. See the
    // file header.
    PROCESSING_PURPOSE_SPECS: persona.PROCESSING_PURPOSE_SPECS,
    renderPurposeOnSummary: persona.renderPurposeOnSummary,
  };
});

interface HttpError extends Error {
  statusCode: number;
  statusMessage?: string;
  data?: unknown;
}

interface TestConfig {
  features: Record<string, boolean>;
  persona?: unknown;
  dataSharing?: unknown;
}

interface RecipientFixture {
  id: string;
  name: string;
  privacyPolicyUrl: string;
  purposes: string[];
  relationship: string;
}

let db: DB;
let currentUser: { id: string } | null = null;
let testConfig: TestConfig;
let requestBody: unknown;
let requestHeaders: Record<string, string>;

{
  const g = globalThis as Record<string, unknown>;
  g.defineEventHandler = (fn: unknown): unknown => fn;
  g.createError = (opts: {
    statusCode: number;
    statusMessage?: string;
    data?: unknown;
  }): HttpError => {
    const e = new Error(opts.statusMessage ?? 'Error') as HttpError;
    e.statusCode = opts.statusCode;
    e.statusMessage = opts.statusMessage;
    e.data = opts.data;
    return e;
  };
  // Real semantics: 401 when there is no authenticated user.
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
  g.getRequestIP = (): string => '203.0.113.9';
  g.getRequestHeader = (_event: H3Event, name: string): string | undefined =>
    requestHeaders[name.toLowerCase()];
  // `parseBody` reads the raw body first (its own 10MB guard) and then the
  // parsed one; both come from the per-test `requestBody`.
  g.readRawBody = async (): Promise<string> => JSON.stringify(requestBody ?? null);
  g.readBody = async (): Promise<unknown> => requestBody;
}

// Imported AFTER the globals exist: these modules call them, they do not capture
// them at module scope, but the route modules run `defineEventHandler` on load.
const validate = await import('../../../utils/validate');
{
  const g = globalThis as Record<string, unknown>;
  g.requireFeature = validate.requireFeature;
  g.parseBody = validate.parseBody;
}

const getMod = await import('../purposes.get');
const putMod = await import('../purposes.put');
const historyMod = await import('../purposes/history.get');
const getHandler = getMod.default as (event: H3Event) => Promise<unknown>;
const putHandler = putMod.default as (event: H3Event) => Promise<unknown>;
const historyHandler = historyMod.default as (event: H3Event) => Promise<unknown>;

const fakeEvent = { method: 'PUT', path: '/api/consent/purposes' } as unknown as H3Event;

/**
 * The instance BASELINE for this suite: one papered recipient covering one
 * purpose.
 *
 * It has to be the baseline now, because both surviving purposes require a
 * declared recipient and an instance that has named none offers nothing at all.
 * That is the makerspace case rather than a broken fixture, and it gets its own
 * test below instead of being papered over here.
 */
const RECIPIENT: RecipientFixture = {
  id: 'contoso-tools',
  name: 'Contoso Tools',
  privacyPolicyUrl: 'https://contoso.example/privacy',
  purposes: ['sponsor_sharing'],
  relationship: 'processor',
};

/** A SECOND recipient for the same purpose, used to move the scope digest. */
const SECOND_RECIPIENT: RecipientFixture = {
  id: 'acme-robotics',
  name: 'Acme Robotics',
  privacyPolicyUrl: 'https://acme.example/privacy',
  purposes: ['sponsor_sharing'],
  relationship: 'processor',
};

function failure(p: Promise<unknown>): Promise<HttpError> {
  return p.then(
    () => {
      throw new Error('expected the handler to throw, it resolved');
    },
    (e: HttpError) => e,
  );
}

async function currentRows(userId: string): Promise<Array<Record<string, unknown>>> {
  return await db
    .select()
    .from(userPurposeConsents)
    .where(
      and(eq(userPurposeConsents.userId, userId), isNull(userPurposeConsents.supersededAt)),
    );
}

async function allRows(userId: string): Promise<Array<Record<string, unknown>>> {
  return await db.select().from(userPurposeConsents).where(eq(userPurposeConsents.userId, userId));
}

interface PurposesPayload {
  scopeDigest: string;
  policyVersion: string;
  purposes: Array<Record<string, unknown>>;
}

async function readPurposes(): Promise<PurposesPayload> {
  return (await getHandler(fakeEvent)) as PurposesPayload;
}

// `createTestDB` spins up PGlite and pushes the whole schema, which is well over
// vitest's 10s default hook budget on a cold cache.
beforeAll(async () => {
  db = await createTestDB();
}, 120_000);

afterAll(async () => {
  await closeTestDB(db);
});

beforeEach(() => {
  testConfig = {
    features: { dataSharingConsents: true },
    dataSharing: { recipients: [RECIPIENT] },
  };
  requestBody = undefined;
  requestHeaders = { 'user-agent': 'Mozilla/5.0 (test)' };
  currentUser = null;
});

describe('the feature flag gate', () => {
  it('GET is 404, not 403, when dataSharingConsents is off', async () => {
    testConfig.features.dataSharingConsents = false;
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const err = await failure(getHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });

  it('PUT is 404 when dataSharingConsents is off', async () => {
    testConfig.features.dataSharingConsents = false;
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: 'abc' };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });

  it('the flag is checked BEFORE auth, so an anonymous probe cannot detect the feature', async () => {
    testConfig.features.dataSharingConsents = false;
    currentUser = null;
    const err = await failure(getHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });

  it('an anonymous caller gets 401 once the flag is on', async () => {
    currentUser = null;
    const err = await failure(getHandler(fakeEvent));
    expect(err.statusCode).toBe(401);
  });

  it('a missing flag key is treated as off', async () => {
    testConfig.features = {};
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const err = await failure(getHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });
});

describe('GET /api/consent/purposes', () => {
  it('returns the digest, the policy version and the offerable purposes only', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };

    const payload = await readPurposes();

    expect(payload.scopeDigest).toEqual(expect.any(String));
    expect(payload.scopeDigest.length).toBeGreaterThan(0);
    // `varchar(16)`: a digest that does not fit the column could never be stored.
    expect(payload.scopeDigest.length).toBeLessThanOrEqual(16);
    expect(payload.policyVersion).toBe('1');

    // One recipient, covering one purpose. The other is not offerable and is
    // ABSENT: not present-and-disabled, and not a structural zero (Appendix B9).
    expect(payload.purposes.map((p) => p.id)).toEqual(['sponsor_sharing']);
  });

  it('an instance that has named no recipient asks NOTHING', async () => {
    // The makerspace case (plan R2.3), asserted deliberately rather than
    // arrived at by accident. Both purposes require a declared recipient, so a
    // default instance offers none: no card, no switch, and a client that
    // renders a "Sharing choices" heading over this payload would be announcing
    // recruiters to an operator who does not have any.
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    delete testConfig.dataSharing;

    const payload = await readPurposes();
    expect(payload.purposes).toEqual([]);
  });

  /**
   * The card list is what the page renders as switches, so this is the
   * member-facing half of widening `OFFERED_PROCESSING_PURPOSES` (member
   * visibility directory, plan section 5.1). The pair matters more than either
   * half: a recipient makes the choices appear, and no recipient means the
   * change is invisible.
   */
  it('offers both switches once a papered recipient covers both', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    testConfig.dataSharing = {
      recipients: [
        {
          id: 'acme-robotics',
          name: 'Acme Robotics',
          privacyPolicyUrl: 'https://acme.example/privacy',
          purposes: ['recruiter_visibility', 'sponsor_sharing'],
          relationship: 'independent_controller',
          agreementRef: 'https://acme.example/dpa',
        },
      ],
    };

    const payload = await readPurposes();
    expect(payload.purposes.map((p) => p.id)).toEqual([
      'recruiter_visibility',
      'sponsor_sharing',
    ]);
    // Every offerable purpose now discloses to somebody, by definition: there is
    // no longer a purpose that discloses to nobody, so a card with an empty
    // recipient list would be a card whose own sentence it cannot substantiate.
    const byId = new Map(payload.purposes.map((p) => [p.id as string, p]));
    expect((byId.get('recruiter_visibility')!.recipients as unknown[]).length).toBe(1);
    expect((byId.get('sponsor_sharing')!.recipients as unknown[]).length).toBe(1);
  });

  it('offers NOTHING when the only covering recipient is an unpapered controller', async () => {
    // Widening the offered constant must not become a way to deploy past an
    // undocumented onward transfer. With no purpose left that discloses to
    // nobody, the refusal is now total rather than partial.
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    testConfig.dataSharing = {
      recipients: [
        {
          id: 'acme-robotics',
          name: 'Acme Robotics',
          privacyPolicyUrl: 'https://acme.example/privacy',
          purposes: ['recruiter_visibility', 'sponsor_sharing'],
          relationship: 'independent_controller',
        },
      ],
    };

    const payload = await readPurposes();
    expect(payload.purposes).toEqual([]);
  });

  it('carries every field the consent card renders, with off before on', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };

    const [card] = (await readPurposes()).purposes;
    expect(card).toBeDefined();
    expect(Object.keys(card as object).sort()).toEqual(
      [
        'actedAt',
        'answersAfterRevocation',
        'id',
        'label',
        'legalBasis',
        'needsReconfirmation',
        'offSummary',
        'onSummary',
        'recipients',
        'revocationEffect',
        'state',
      ].sort(),
    );
    expect(card?.id).toBe('sponsor_sharing');
    expect(card?.legalBasis).toBe('consent');
    // Renamed with the visibility inversion: after it, most answers are not on
    // a profile at all, so `kept_on_your_profile` named a place the data is not.
    expect(card?.answersAfterRevocation).toBe('kept_in_your_account');
    expect(card?.state).toBe('absent');
    expect(card?.needsReconfirmation).toBe(false);
    expect(card?.actedAt).toBeNull();
    // The copy says what LEAVES, to whom, and that it cannot be recalled. The
    // old assertion looked for the counting disclosure, which is no longer this
    // card's subject: counting is legitimate interest and is disclosed on the
    // privacy page beside its objection.
    expect(String(card?.onSummary)).toContain('sponsors named below');
    expect(String(card?.revocationEffect)).toContain('cannot recall what was already shared');
    expect(String(card?.onSummary)).not.toContain('counted');
  });

  it('lists only the recipients THIS purpose discloses to', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    testConfig.dataSharing = {
      recipients: [
        RECIPIENT,
        { ...SECOND_RECIPIENT, purposes: ['recruiter_visibility'] },
      ],
    };

    const byId = new Map(
      (await readPurposes()).purposes.map((p) => [
        p.id as string,
        p.recipients as Array<{ id: string; privacyPolicyUrl: string }>,
      ]),
    );
    expect(byId.get('sponsor_sharing')?.map((r) => r.id)).toEqual(['contoso-tools']);
    expect(byId.get('sponsor_sharing')?.[0]?.privacyPolicyUrl).toBe(
      'https://contoso.example/privacy',
    );
    // The one that matters: a sponsor named for one purpose must not appear on
    // the other card, or the card misstates the disclosure it is asking for.
    expect(byId.get('recruiter_visibility')?.map((r) => r.id)).toEqual(['acme-robotics']);
  });

  it('reports one user answer without leaking another user answer', async () => {
    const mine = await createTestUser(db);
    const theirs = await createTestUser(db);

    currentUser = { id: theirs.id };
    const digest = (await readPurposes()).scopeDigest;
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest };
    await putHandler(fakeEvent);

    currentUser = { id: mine.id };
    const [card] = (await readPurposes()).purposes;
    expect(card?.state).toBe('absent');
    expect(card?.actedAt).toBeNull();
  });
});

describe('PUT /api/consent/purposes — the body contract', () => {
  beforeEach(async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
  });

  it('rejects an unknown key, so a client cannot supply its own policyVersion', async () => {
    const digest = (await readPurposes()).scopeDigest;
    requestBody = {
      purpose: 'sponsor_sharing',
      grant: true,
      scopeDigest: digest,
      policyVersion: '99',
    };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(400);
  });

  it('rejects a client-supplied scopeSnapshot', async () => {
    const digest = (await readPurposes()).scopeDigest;
    requestBody = {
      purpose: 'sponsor_sharing',
      grant: true,
      scopeDigest: digest,
      scopeSnapshot: { purposeLabel: 'anything at all' },
    };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(400);
  });

  it('rejects a bulk array body: one purpose per request', async () => {
    const digest = (await readPurposes()).scopeDigest;
    requestBody = [
      { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest },
      { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest },
    ];
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(400);
  });

  it('rejects a missing scopeDigest rather than defaulting one', async () => {
    requestBody = { purpose: 'sponsor_sharing', grant: true };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(400);
    const data = err.data as { errors?: Record<string, unknown> };
    expect(Object.keys(data.errors ?? {})).toContain('scopeDigest');
  });

  it('rejects a non-boolean grant: there is no third state', async () => {
    const digest = (await readPurposes()).scopeDigest;
    requestBody = { purpose: 'sponsor_sharing', grant: 'yes', scopeDigest: digest };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(400);
  });

  it('an unknown purpose is 404 PURPOSE_NOT_OFFERED, not 400', async () => {
    const digest = (await readPurposes()).scopeDigest;
    requestBody = { purpose: 'made_up', grant: true, scopeDigest: digest };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
    expect((err.data as { code: string }).code).toBe('PURPOSE_NOT_OFFERED');
  });

  it('a grant for a registered but NOT offered purpose is 404', async () => {
    // `recruiter_visibility` is in the registry and in the offered constant, but
    // this instance has named no recipient for it, so it is not offerable here.
    const digest = (await readPurposes()).scopeDigest;
    requestBody = { purpose: 'recruiter_visibility', grant: true, scopeDigest: digest };
    const err = await failure(putHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
    expect((err.data as { code: string }).code).toBe('PURPOSE_NOT_OFFERED');
  });
});

describe('PUT /api/consent/purposes — the write', () => {
  it('a grant writes exactly one current row, with the server-supplied context', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const digest = (await readPurposes()).scopeDigest;

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest };
    const result = (await putHandler(fakeEvent)) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.written).toBe(true);
    expect(result.state).toBe('granted');
    expect(result.scopeDigest).toBe(digest);

    const rows = await currentRows(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('granted');
    expect(rows[0]?.scopeDigest).toBe(digest);
    // Supplied by the SERVER, never by the body.
    expect(rows[0]?.policyVersion).toBe('1');
    expect(rows[0]?.source).toBe('settings');
    expect(rows[0]?.ipAddress).toBe('203.0.113.9');
    expect(rows[0]?.userAgent).toBe('Mozilla/5.0 (test)');
    expect(rows[0]?.scopeSnapshot).toMatchObject({
      purposeLabel: expect.any(String),
      policyVersion: '1',
    });

    // And the GET now reports it as authorised without a re-confirm.
    const [card] = (await readPurposes()).purposes;
    expect(card?.state).toBe('granted');
    expect(card?.needsReconfirmation).toBe(false);
    expect(typeof card?.actedAt).toBe('string');
  });

  it('truncates a hostile user-agent rather than growing the consent log', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    requestHeaders['user-agent'] = 'x'.repeat(5000);
    const digest = (await readPurposes()).scopeDigest;

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest };
    await putHandler(fakeEvent);

    const rows = await currentRows(user.id);
    expect(String(rows[0]?.userAgent)).toHaveLength(512);
  });

  it('a revoke SUPERSEDES the grant, it does not delete it', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const digest = (await readPurposes()).scopeDigest;

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest };
    await putHandler(fakeEvent);
    requestBody = { purpose: 'sponsor_sharing', grant: false, scopeDigest: digest };
    const result = (await putHandler(fakeEvent)) as Record<string, unknown>;

    expect(result.state).toBe('revoked');
    expect(result.written).toBe(true);

    const history = await allRows(user.id);
    expect(history).toHaveLength(2);
    // The grant is still on the record, superseded rather than erased: that IS
    // the Art. 7(1) evidence that consent was once obtained.
    const granted = history.find((r) => r.state === 'granted');
    expect(granted).toBeDefined();
    expect(granted?.supersededAt).not.toBeNull();

    const rows = await currentRows(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('revoked');

    // A revocation is reported as revoked, never as "absent" and never as a
    // question to ask again.
    const [card] = (await readPurposes()).purposes;
    expect(card?.state).toBe('revoked');
    expect(card?.needsReconfirmation).toBe(false);
  });

  it('a grant, revoke, grant sequence keeps all three rows and one current row', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const digest = (await readPurposes()).scopeDigest;

    for (const grant of [true, false, true]) {
      requestBody = { purpose: 'sponsor_sharing', grant, scopeDigest: digest };
      await putHandler(fakeEvent);
    }

    expect(await allRows(user.id)).toHaveLength(3);
    expect(await currentRows(user.id)).toHaveLength(1);
  });

  it('a no-op toggle writes nothing', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const digest = (await readPurposes()).scopeDigest;

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest };
    const first = (await putHandler(fakeEvent)) as Record<string, unknown>;
    const second = (await putHandler(fakeEvent)) as Record<string, unknown>;

    expect(first.written).toBe(true);
    expect(second.written).toBe(false);
    expect(second.actedAt).toBe(first.actedAt);
    // One row, not two: re-clicking a toggle onto the value it already holds
    // must not append an unbounded history.
    expect(await allRows(user.id)).toHaveLength(1);
  });

  it('a withdrawal is allowed even after the purpose stops being offered', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const digest = (await readPurposes()).scopeDigest;
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: digest };
    await putHandler(fakeEvent);

    // The operator removes the recipient, so `sponsor_sharing` is no longer
    // offerable at all. A user who could not then turn it OFF would have been
    // trapped by a config change, which is the shape Art. 7(3) forbids.
    delete testConfig.dataSharing;
    const staleFree = (await readPurposes()).scopeDigest;
    requestBody = { purpose: 'sponsor_sharing', grant: false, scopeDigest: staleFree };
    const result = (await putHandler(fakeEvent)) as Record<string, unknown>;
    expect(result.state).toBe('revoked');

    const rows = await currentRows(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('revoked');
  });
});

describe('PUT /api/consent/purposes — the 409 SCOPE_CHANGED handshake', () => {
  it('refuses a stale digest and returns the new list plus a resolved diff', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };

    const before = await readPurposes();
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: before.scopeDigest };
    await putHandler(fakeEvent);

    // The operator adds a SECOND recipient while the user is reading the page.
    testConfig.dataSharing = { recipients: [RECIPIENT, SECOND_RECIPIENT] };

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: before.scopeDigest };
    const err = await failure(putHandler(fakeEvent));

    expect(err.statusCode).toBe(409);
    const data = err.data as {
      code: string;
      retryable: boolean;
      expectedScopeDigest: string;
      receivedScopeDigest: string;
      policyVersion: string;
      purposes: Array<Record<string, unknown>>;
      diff: {
        resolved: boolean;
        recipientsAdded: Array<{ id: string; name: string; privacyPolicyUrl: string }>;
        recipientsRemoved: unknown[];
        countedFieldsAdded: string[];
        countedFieldsRemoved: string[];
        policyVersionChanged: unknown;
        truncated: boolean;
      };
    };

    expect(data.code).toBe('SCOPE_CHANGED');
    // Never auto-retry: the client must show the diff and take one more click.
    expect(data.retryable).toBe(false);
    expect(data.receivedScopeDigest).toBe(before.scopeDigest);
    expect(data.expectedScopeDigest).not.toBe(before.scopeDigest);

    // The FULL new purpose list, so the settings page can re-render from the 409
    // rather than firing a second request.
    expect(data.purposes.map((p) => p.id)).toEqual(['sponsor_sharing']);
    expect(data.purposes[0]?.recipients).toHaveLength(2);
    // The stored grant is now stale, so the card asks for confirmation.
    expect(data.purposes[0]?.needsReconfirmation).toBe(true);

    expect(data.diff.resolved).toBe(true);
    expect(data.diff.recipientsAdded).toHaveLength(1);
    expect(data.diff.recipientsAdded[0]?.name).toBe('Acme Robotics');
    expect(data.diff.recipientsAdded[0]?.privacyPolicyUrl).toBe('https://acme.example/privacy');
    expect(data.diff.recipientsRemoved).toEqual([]);
    // Only the recipient moved; the counted fields did not.
    expect(data.diff.countedFieldsAdded).toEqual([]);
    expect(data.diff.countedFieldsRemoved).toEqual([]);
    expect(data.diff.policyVersionChanged).toBeNull();
    expect(data.diff.truncated).toBe(false);
  });

  it('never auto-applies the pending grant: the stored row is untouched', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };

    const before = await readPurposes();
    requestBody = { purpose: 'sponsor_sharing', grant: false, scopeDigest: before.scopeDigest };
    await putHandler(fakeEvent);

    testConfig.dataSharing = { recipients: [RECIPIENT, SECOND_RECIPIENT] };
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: before.scopeDigest };
    await failure(putHandler(fakeEvent));

    const rows = await currentRows(user.id);
    expect(rows).toHaveLength(1);
    // Still the revocation. A 409 writes nothing.
    expect(rows[0]?.state).toBe('revoked');
    expect(await allRows(user.id)).toHaveLength(1);
  });

  it('reports an UNRESOLVED diff rather than inventing one when the digest is unknown', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: 'ffffffff' };
    const err = await failure(putHandler(fakeEvent));

    expect(err.statusCode).toBe(409);
    const diff = (err.data as { diff: Record<string, unknown> }).diff;
    // A digest is one-way. With no stored snapshot carrying it there is nothing
    // to diff against, and the honest answer is to say so rather than to render
    // a list of "changes" that are really just the current scope.
    expect(diff.resolved).toBe(false);
    expect(diff.recipientsAdded).toEqual([]);
    expect(diff.recipientsRemoved).toEqual([]);
    expect(diff.countedFieldsAdded).toEqual([]);
    expect(diff.countedFieldsRemoved).toEqual([]);
    expect(diff.policyVersionChanged).toBeNull();
  });

  it('names the counted fields that changed and reports a policy-version move', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };

    const before = await readPurposes();
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: before.scopeDigest };
    await putHandler(fakeEvent);

    // The operator publishes a template with ONE aggregatable field that did not
    // exist before, and bumps the policy version.
    testConfig.persona = {
      sections: [
        {
          key: 'workshop',
          label: 'Workshop',
          fields: [
            {
              key: 'bench_size',
              label: 'Bench size',
              type: 'select',
              options: [
                { value: 'small', label: 'Small' },
                { value: 'large', label: 'Large' },
              ],
            },
          ],
        },
      ],
    };
    // The recipient list is UNCHANGED: keeping it is what makes the purpose
    // still offerable, so the write reaches the digest check and returns 409
    // rather than 404. The digest moves on the fields and the policy version.
    testConfig.dataSharing = { recipients: [RECIPIENT], policyVersion: '2' };

    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest: before.scopeDigest };
    const err = await failure(putHandler(fakeEvent));
    const diff = (err.data as {
      diff: {
        resolved: boolean;
        countedFieldsAdded: string[];
        countedFieldsRemoved: string[];
        policyVersionChanged: { from: string; to: string } | null;
      };
    }).diff;

    expect(diff.resolved).toBe(true);
    expect(diff.countedFieldsAdded).toEqual(['bench_size']);
    // The built-in aggregatable fields stopped being counted.
    expect(diff.countedFieldsRemoved.length).toBeGreaterThan(0);
    expect(diff.countedFieldsRemoved).toContain('interests');
    expect(diff.policyVersionChanged).toEqual({ from: '1', to: '2' });
  });
});

/**
 * GET /api/consent/purposes/history — plan 6.8's consent history table.
 *
 * The one surface where a person can read back what they agreed to and when,
 * against the disclosure they were shown at the time. That is why superseded
 * rows are returned: a history that showed only the current answer would be a
 * state readout, and a legal record that quietly drops what came before is the
 * opposite of what an audit trail is for.
 */
describe('GET /api/consent/purposes/history', () => {
  interface HistoryPayload {
    history: Array<{
      id: string;
      purpose: string;
      state: string;
      actedAt: string;
      policyVersion: string;
      scopeDigest: string;
      source: string | null;
      scopeSnapshot: { purposeLabel: string } | null;
    }>;
  }

  it('is 404 when dataSharingConsents is off, and checks the flag before auth', async () => {
    testConfig.features.dataSharingConsents = false;
    currentUser = null;
    const err = await failure(historyHandler(fakeEvent));
    expect(err.statusCode).toBe(404);
  });

  it('is 401 for an anonymous caller once the flag is on', async () => {
    currentUser = null;
    const err = await failure(historyHandler(fakeEvent));
    expect(err.statusCode).toBe(401);
  });

  it('returns every row newest first, superseded ones included', async () => {
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const { scopeDigest } = await readPurposes();

    for (const grant of [true, false, true]) {
      requestBody = { purpose: 'sponsor_sharing', grant, scopeDigest };
      await putHandler(fakeEvent);
    }

    const payload = (await historyHandler(fakeEvent)) as HistoryPayload;
    // Guard: three acts wrote three rows, and only one of them is current.
    expect(payload.history).toHaveLength(3);
    expect(await currentRows(user.id)).toHaveLength(1);

    const states = payload.history.map((row) => row.state);
    expect(states).toEqual(['granted', 'revoked', 'granted']);

    const times = payload.history.map((row) => Date.parse(row.actedAt));
    expect(times.every((t) => Number.isFinite(t)), 'actedAt must be a parseable ISO string').toBe(true);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i - 1]! >= times[i]!, 'newest first').toBe(true);
    }

    const first = payload.history[0]!;
    expect(first.scopeDigest).toBe(scopeDigest);
    expect(first.scopeSnapshot?.purposeLabel, 'the snapshot records what was shown').toBeTruthy();
    expect(first.source).toBe('settings');
  });

  it('never returns the IP or the user agent', async () => {
    // Both are held (the DSAR export carries them, which is the surface built
    // for handing someone everything about themselves). They are evidence of
    // the act, not something a person needs on a settings screen, and echoing a
    // stored IP back into a page is a disclosure with no purpose.
    const user = await createTestUser(db);
    currentUser = { id: user.id };
    const { scopeDigest } = await readPurposes();
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest };
    await putHandler(fakeEvent);

    const payload = (await historyHandler(fakeEvent)) as HistoryPayload;
    expect(payload.history).toHaveLength(1);
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain('ipAddress');
    expect(serialised).not.toContain('userAgent');
    expect(serialised, 'the stored UA must not leak through a renamed key').not.toContain('Mozilla');
  });

  it('one user never sees another user history', async () => {
    const [alice, bob] = await Promise.all([createTestUser(db), createTestUser(db)]);
    currentUser = { id: alice.id };
    const { scopeDigest } = await readPurposes();
    requestBody = { purpose: 'sponsor_sharing', grant: true, scopeDigest };
    await putHandler(fakeEvent);

    currentUser = { id: bob.id };
    const payload = (await historyHandler(fakeEvent)) as HistoryPayload;
    expect(payload.history).toEqual([]);
    // Guard: alice really did write a row, so the empty list above is scoping
    // rather than a write that never happened.
    expect(await allRows(alice.id)).toHaveLength(1);
  });
});

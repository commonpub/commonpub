/**
 * Behavioural tests for `GET /api/consent/objection` and `PUT /api/consent/objection`.
 *
 * These drive the REAL route handlers against a REAL (PGlite) database, through
 * the REAL `getStatisticsObjection` / `setStatisticsObjection` from
 * `packages/server/src/persona/objections.ts`. The rows asserted below are rows
 * Postgres actually holds, under the real primary key on `user_id`. The Nitro
 * auto-imports are stubbed with their REAL semantics (`requireFeature` and
 * `parseBody` are the actual implementations from
 * `layers/base/server/utils/validate.ts`), so the 404 and the 400 body shape are
 * the ones a client really sees.
 *
 * WHAT THESE TESTS ARE FOR. The objection is the one control in this feature
 * whose default is ON, and it is deliberately not a consent row. Four properties
 * carry that and each has a test that fails when it is broken:
 *
 *   1. no record means COUNTED, and the payload says so in the registry's words;
 *   2. nothing is ever written to `user_purpose_consents`, and no scope digest
 *      or snapshot appears anywhere on the wire (plan R3.1 D5);
 *   3. the copy carries THIS instance's k-anonymity floor, not a plausible one;
 *   4. objecting survives the feature flag, because the direction that STOPS
 *      processing is never the gated one.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { userPurposeConsents, userStatisticsObjections } from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import {
  createTestDB,
  closeTestDB,
  createTestUser,
} from '../../../../../../packages/server/src/__tests__/helpers/testdb';
import type { DB } from '../../../../../../packages/server/src/types';

vi.mock('@commonpub/server', async () => {
  const [objections, metrics, persona] = await Promise.all([
    import('../../../../../../packages/server/src/persona/objections'),
    // `resolvePersonaThresholds` lives here, beside the queries that clamp with
    // it. Taking it from the same module the aggregates use is the point: the
    // number in the sentence and the number in the SQL are one function.
    import('../../../../../../packages/server/src/persona/metrics'),
    import('../../../../../../packages/persona/src/index'),
  ]);
  return {
    ...metrics,
    ...objections,
    // Pure-brain values the route reaches through the server barrel.
    PERSONA_STATISTICS: persona.PERSONA_STATISTICS,
    STATISTICS_LEGAL_BASIS: persona.STATISTICS_LEGAL_BASIS,
    dataSharingConfigSchema: persona.dataSharingConfigSchema,
    renderStatisticsSummary: persona.renderStatisticsSummary,
    statisticsStateSummary: persona.statisticsStateSummary,
  };
});

const { PERSONA_STATISTICS, renderStatisticsSummary } = await import(
  '../../../../../../packages/persona/src/index'
);

interface HttpError extends Error {
  statusCode: number;
  statusMessage?: string;
  data?: unknown;
}

interface TestConfig {
  features: Record<string, boolean>;
  dataSharing?: unknown;
}

let db: DB;
let currentUser: { id: string } | null = null;
let testConfig: TestConfig;
let requestBody: unknown;

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
  g.getRequestHeader = (): string | undefined => undefined;
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

const getMod = await import('../objection.get');
const putMod = await import('../objection.put');
// `as unknown as` because the handlers are typed with their real payloads and
// these tests read them as loose records to assert on ABSENT keys as well as
// present ones (`not.toHaveProperty('scopeDigest')` is the point of one of them,
// and a typed handle would make that assertion unwritable).
const getHandler = getMod.default as unknown as (
  event: H3Event,
) => Promise<Record<string, unknown>>;
const putHandler = putMod.default as unknown as (
  event: H3Event,
) => Promise<Record<string, unknown>>;

const fakeEvent = { method: 'PUT', path: '/api/consent/objection' } as unknown as H3Event;

function failure(p: Promise<unknown>): Promise<HttpError> {
  return p.then(
    () => {
      throw new Error('expected the handler to throw, it resolved');
    },
    (e: HttpError) => e,
  );
}

async function objectionRows(userId: string): Promise<Array<Record<string, unknown>>> {
  return await db
    .select()
    .from(userStatisticsObjections)
    .where(eq(userStatisticsObjections.userId, userId));
}

async function newUser(): Promise<{ id: string }> {
  const user = await createTestUser(db);
  currentUser = { id: user.id };
  return { id: user.id };
}

async function put(objected: boolean): Promise<Record<string, unknown>> {
  requestBody = { objected };
  return await putHandler(fakeEvent);
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
  testConfig = { features: { persona: true } };
  requestBody = undefined;
  currentUser = null;
});

describe('the feature flag gate', () => {
  it('GET is 404, not 403, when persona is off', async () => {
    testConfig.features.persona = false;
    await newUser();
    expect((await failure(getHandler(fakeEvent))).statusCode).toBe(404);
  });

  it('the flag is checked BEFORE auth, so an anonymous probe cannot detect the feature', async () => {
    testConfig.features.persona = false;
    currentUser = null;
    expect((await failure(getHandler(fakeEvent))).statusCode).toBe(404);
  });

  it('an anonymous caller gets 401 once the flag is on', async () => {
    currentUser = null;
    expect((await failure(getHandler(fakeEvent))).statusCode).toBe(401);
  });

  it('a missing flag key is treated as off', async () => {
    testConfig.features = {};
    await newUser();
    expect((await failure(getHandler(fakeEvent))).statusCode).toBe(404);
  });

  it('OBJECTING survives the flag, and only lifting an objection needs it', async () => {
    // The direction that STOPS processing is never gated. `purposes.put.ts`
    // applies the same rule to a consent withdrawal, and here it points the
    // other way because here it is objecting that reduces what is done.
    const user = await newUser();
    testConfig.features.persona = false;

    const wrote = await put(true);
    expect(wrote.objected).toBe(true);
    expect(await objectionRows(user.id)).toHaveLength(1);

    requestBody = { objected: false };
    expect((await failure(putHandler(fakeEvent))).statusCode).toBe(404);
    // And the refusal is still on record, which is the point of not gating it.
    expect(await objectionRows(user.id)).toHaveLength(1);
  });
});

describe('GET /api/consent/objection', () => {
  it('reports COUNTED for a member with no record, in the registry words', async () => {
    await newUser();
    const payload = await getHandler(fakeEvent);

    expect(payload.state).toBe('counted');
    expect(payload.objected).toBe(false);
    expect(payload.objectedAt).toBeNull();
    expect(payload.statusSummary).toBe(PERSONA_STATISTICS.countedSummary);
    expect(payload.label).toBe(PERSONA_STATISTICS.label);
    expect(payload.basisNote).toBe(PERSONA_STATISTICS.basisNote);
    expect(payload.objectLabel).toBe(PERSONA_STATISTICS.objectLabel);
    expect(payload.withdrawObjectionLabel).toBe(PERSONA_STATISTICS.withdrawObjectionLabel);
  });

  it('states legitimate interest, never consent', async () => {
    await newUser();
    const payload = await getHandler(fakeEvent);
    expect(payload.legalBasis).toBe('legitimate_interest');
    expect(payload.legalBasis).not.toBe('consent');
  });

  it('carries no scope digest, no snapshot and no policy version', async () => {
    // Plan R3.1 D5. A digest exists to lapse a GRANT when the terms move, and a
    // refusal must survive exactly that change. Carrying one here would be the
    // first step to an objection that quietly expires.
    await newUser();
    const payload = await getHandler(fakeEvent);
    for (const key of ['scopeDigest', 'scopeSnapshot', 'policyVersion', 'needsReconfirmation']) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it('substitutes THIS instance k-anonymity floor into the copy', async () => {
    // The template names `{minBucket}`. An instance running 25 must not be told
    // "at least 5 people", which would understate its members' protection by
    // five times.
    testConfig.dataSharing = { minBucket: 25, minPopulation: 100 };
    await newUser();
    const payload = await getHandler(fakeEvent);

    expect(payload.description).toBe(
      renderStatisticsSummary({ minBucket: 25, minPopulation: 100 }),
    );
    expect(String(payload.description)).toContain('at least 25 people');
    expect(String(payload.description)).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('falls back to the package floors when the dataSharing document is malformed', async () => {
    // A config typo must not make it impossible to record an objection. It
    // resolves to the conservative floor instead.
    testConfig.dataSharing = { minBucket: 'five' };
    await newUser();
    const payload = await getHandler(fakeEvent);
    expect(String(payload.description)).toContain('at least 5 people');
  });

  it('reports OBJECTED, with the timestamp, once a row exists', async () => {
    await newUser();
    await put(true);
    const payload = await getHandler(fakeEvent);
    expect(payload.state).toBe('objected');
    expect(payload.objected).toBe(true);
    expect(payload.statusSummary).toBe(PERSONA_STATISTICS.objectedSummary);
    // ISO, never a locale string: the server timezone is not the reader's.
    expect(String(payload.objectedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });
});

describe('PUT /api/consent/objection', () => {
  it('records an objection as one row, and reports it changed', async () => {
    const user = await newUser();
    const result = await put(true);

    expect(result.changed).toBe(true);
    expect(result.state).toBe('objected');
    const rows = await objectionRows(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(user.id);
  });

  it('is idempotent, keeps the FIRST timestamp, and never raises a duplicate key', async () => {
    const user = await newUser();
    const first = await put(true);
    const second = await put(true);

    expect(second.changed).toBe(false);
    expect(second.state).toBe('objected');
    // Re-recording `objected_at` would rewrite the date of the member's own act
    // every time a button was pressed.
    expect(second.objectedAt).toBe(first.objectedAt);
    expect(await objectionRows(user.id)).toHaveLength(1);
  });

  it('lifts the objection by deleting the row, and is idempotent that way too', async () => {
    const user = await newUser();
    await put(true);

    const lifted = await put(false);
    expect(lifted.changed).toBe(true);
    expect(lifted.state).toBe('counted');
    expect(lifted.objectedAt).toBeNull();
    expect(await objectionRows(user.id)).toHaveLength(0);

    const again = await put(false);
    expect(again.changed).toBe(false);
    expect(again.state).toBe('counted');
  });

  it('writes NOTHING to the consent table', async () => {
    // Consent and objection are different legal instruments. An objection
    // folded into `user_purpose_consents` would make the consent history
    // unreadable as evidence of either, and would lapse with the next digest.
    const user = await newUser();
    await put(true);
    await put(false);
    await put(true);

    const consents = await db
      .select()
      .from(userPurposeConsents)
      .where(eq(userPurposeConsents.userId, user.id));
    expect(consents).toHaveLength(0);
    // Guard: the writes above really happened, so the emptiness is meaningful.
    expect(await objectionRows(user.id)).toHaveLength(1);
  });

  it('is scoped by the session user, so one member cannot move another', async () => {
    const alice = await newUser();
    await put(true);

    const bob = await newUser();
    expect(await objectionRows(bob.id)).toHaveLength(0);
    expect((await getHandler(fakeEvent)).state).toBe('counted');
    // Alice's row is untouched by anything Bob does.
    await put(true);
    expect(await objectionRows(alice.id)).toHaveLength(1);
  });

  it('rejects a body carrying anything but `objected`', async () => {
    // `.strict()`. A client sending a scope digest gets a 400 rather than being
    // quietly ignored, because being quietly ignored is how a surface starts
    // believing it recorded something it did not.
    await newUser();
    requestBody = { objected: true, scopeDigest: 'abc' };
    expect((await failure(putHandler(fakeEvent))).statusCode).toBe(400);
    expect(await objectionRows(currentUser!.id)).toHaveLength(0);
  });

  it('rejects a non-boolean and a missing field', async () => {
    await newUser();
    for (const body of [{ objected: 'yes' }, {}, null]) {
      requestBody = body;
      expect((await failure(putHandler(fakeEvent))).statusCode).toBe(400);
    }
  });

  it('answers 401 for an anonymous caller before it reads the body', async () => {
    currentUser = null;
    requestBody = { objected: true };
    expect((await failure(putHandler(fakeEvent))).statusCode).toBe(401);
  });
});

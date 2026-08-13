/**
 * Behavioural + contract tests for the member-facing persona routes
 * (plan sections 4.5, 4.6, 8.4).
 *
 * The sibling route tests in this directory are source-string reads, because no
 * nitro harness is wired here. That style cannot answer the questions that
 * matter for these four routes: whether a disabled flag really produces a 404
 * before anything else runs, whether an untrusted `[fieldKey]` really stops
 * before the SQL bind, and whether an EMPTY `answers` map really reaches
 * `setPersonaSection` instead of being short-circuited as "nothing to do".
 *
 * So this file builds the smallest harness that runs the handlers for real: the
 * Nitro auto-imports are installed on `globalThis` BEFORE the handlers are
 * imported, and `requireAuth`, `requireFeature` and `parseBody` are the ACTUAL
 * implementations from `server/utils/`, not stubs. Only `@commonpub/server` is
 * mocked, since its behaviour has its own integration suites against a real
 * database. `@commonpub/persona` is deliberately NOT mocked: it is pure and its
 * completeness arithmetic is part of what the status route promises.
 *
 * A static contract sweep with a discovery guard (P7) runs at the bottom.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILTIN_PERSONA_SECTIONS } from '@commonpub/persona';
import type { PersonaAnswerMap, PersonaSection } from '@commonpub/persona';
import type { CommonPubConfig } from '@commonpub/config';

// --- @commonpub/server doubles ---------------------------------------------------

const server = vi.hoisted(() => ({
  effectivePersonaSchema: vi.fn(),
  getPersonaValues: vi.fn(),
  personaAnswerMap: vi.fn(),
  setPersonaSection: vi.fn(),
  deletePersonaFieldValue: vi.fn(),
}));
vi.mock('@commonpub/server', () => server);

// --- mutable request state -------------------------------------------------------

interface HttpErrorInit {
  statusCode: number;
  statusMessage: string;
  data?: unknown;
}
interface HttpError extends Error, HttpErrorInit {}

interface StoredValues {
  answers: Record<string, string[]>;
  text: Record<string, string>;
  links: Record<string, string>;
  columns: Record<string, string>;
  retired: Array<{ fieldKey: string; values: string[]; text: string | null; retiredAt: string | null }>;
}

let personaFlag = true;
let authUser: { id: string; username: string; role: string; email: string; emailVerified: boolean } | null = null;
let requestBody: unknown = {};
let cookies: Record<string, string> = {};
let routerParams: Record<string, string> = {};
let storedValues: StoredValues;
let sections: PersonaSection[];
let answerMap: PersonaAnswerMap;

function emptyValues(): StoredValues {
  return { answers: {}, text: {}, links: {}, columns: {}, retired: [] };
}

function config(): CommonPubConfig {
  // Only `features.persona` is read by these routes; everything else is handed
  // straight to the (mocked) server functions, so a narrow stub is honest here.
  return { features: { persona: personaFlag } } as unknown as CommonPubConfig;
}

interface FakeEvent {
  context: { auth?: { user: unknown } };
  method: string;
  path: string;
}

function event(method = 'GET', path = '/api/persona'): FakeEvent {
  return {
    context: authUser === null ? {} : { auth: { user: authUser } },
    method,
    path,
  };
}

// --- Nitro auto-imports, installed before the handlers are loaded ----------------

function createErrorStub(init: HttpErrorInit): HttpError {
  return Object.assign(new Error(init.statusMessage), init) as HttpError;
}

Object.assign(globalThis, {
  defineEventHandler: <T>(handler: T): T => handler,
  createError: createErrorStub,
  useDB: (): Record<string, never> => ({}),
  useConfig: (): CommonPubConfig => config(),
  getCookie: (_e: FakeEvent, name: string): string | undefined => cookies[name],
  getRouterParam: (_e: FakeEvent, name: string): string | undefined => routerParams[name],
  getRequestHeader: (): string | undefined => undefined,
  readRawBody: async (): Promise<string> => JSON.stringify(requestBody),
  readBody: async (): Promise<unknown> => requestBody,
});

// The REAL gates, so a 404/401 assertion below is a statement about shipped code.
const validate = await import('../../utils/validate');
const auth = await import('../../utils/auth');
Object.assign(globalThis, {
  requireFeature: validate.requireFeature,
  parseBody: validate.parseBody,
  parseParams: validate.parseParams,
  requireAuth: auth.requireAuth,
});

type Handler = (e: FakeEvent) => Promise<unknown>;
const personaGet = (await import('../persona.get')).default as unknown as Handler;
const personaPut = (await import('../persona.put')).default as unknown as Handler;
const personaStatus = (await import('../persona/status.get')).default as unknown as Handler;
const retiredDelete = (await import('../persona/retired/[fieldKey].delete')).default as unknown as Handler;

beforeEach(() => {
  vi.clearAllMocks();
  personaFlag = true;
  authUser = { id: 'user-1', username: 'ada', role: 'user', email: 'ada@example.com', emailVerified: true };
  requestBody = {};
  cookies = {};
  routerParams = {};
  storedValues = emptyValues();
  sections = BUILTIN_PERSONA_SECTIONS as unknown as PersonaSection[];
  answerMap = {};

  server.effectivePersonaSchema.mockImplementation(async () => ({
    sections,
    source: 'builtin',
    savedAt: null,
    drift: [],
  }));
  server.getPersonaValues.mockImplementation(async () => storedValues);
  server.personaAnswerMap.mockImplementation(() => answerMap);
  server.setPersonaSection.mockImplementation(async () => ({ ok: true, values: storedValues }));
  server.deletePersonaFieldValue.mockImplementation(async () => ({ deleted: 3 }));
});

it('the four handlers all loaded (a broken import path would otherwise skip every assertion)', () => {
  for (const h of [personaGet, personaPut, personaStatus, retiredDelete]) {
    expect(typeof h).toBe('function');
  }
});

// --- Feature flag ----------------------------------------------------------------

describe('feature flag off', () => {
  beforeEach(() => {
    personaFlag = false;
  });

  it.each([
    ['GET /api/persona', (): Promise<unknown> => personaGet(event())],
    ['PUT /api/persona', (): Promise<unknown> => personaPut(event('PUT'))],
    [
      'DELETE /api/persona/retired/[fieldKey]',
      (): Promise<unknown> => {
        routerParams = { fieldKey: 'old_field' };
        return retiredDelete(event('DELETE', '/api/persona/retired/old_field'));
      },
    ],
  ])('%s is 404, not 403 and not 500', async (_name, call) => {
    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
  });

  it('the 404 comes BEFORE the auth check, so a disabled feature never leaks its existence', async () => {
    authUser = null;
    await expect(personaGet(event())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('no route touches the database when the flag is off', async () => {
    await expect(personaGet(event())).rejects.toThrow();
    await expect(personaPut(event('PUT'))).rejects.toThrow();
    expect(server.effectivePersonaSchema).not.toHaveBeenCalled();
    expect(server.setPersonaSection).not.toHaveBeenCalled();
  });

  it('GET /api/persona/status answers 200 with enabled:false instead of 404', async () => {
    // The banner asks "should I offer this?". A 404 is indistinguishable from a
    // routing bug; `enabled: false` is an answer. This is the one persona route
    // that is deliberately not flag-gated.
    const res = (await personaStatus(event('GET', '/api/persona/status'))) as {
      enabled: boolean;
      offer: boolean;
      completeness: { filled: number; total: number };
    };
    expect(res.enabled).toBe(false);
    expect(res.offer).toBe(false);
    expect(res.completeness).toEqual({ filled: 0, total: 0 });
    expect(server.effectivePersonaSchema).not.toHaveBeenCalled();
  });
});

// --- Authentication --------------------------------------------------------------

describe('unauthenticated', () => {
  beforeEach(() => {
    authUser = null;
  });

  it.each([
    ['GET /api/persona', (): Promise<unknown> => personaGet(event())],
    ['PUT /api/persona', (): Promise<unknown> => personaPut(event('PUT'))],
    ['GET /api/persona/status', (): Promise<unknown> => personaStatus(event('GET', '/api/persona/status'))],
    [
      'DELETE /api/persona/retired/[fieldKey]',
      (): Promise<unknown> => {
        routerParams = { fieldKey: 'old_field' };
        return retiredDelete(event('DELETE', '/api/persona/retired/old_field'));
      },
    ],
  ])('%s is 401', async (_name, call) => {
    await expect(call()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects before any read or write runs', async () => {
    await expect(personaPut(event('PUT'))).rejects.toThrow();
    expect(server.setPersonaSection).not.toHaveBeenCalled();
    expect(server.getPersonaValues).not.toHaveBeenCalled();
  });
});

// --- GET /api/persona ------------------------------------------------------------

describe('GET /api/persona', () => {
  it('returns the effective schema, the viewer OWN values, and the retired block', async () => {
    storedValues = {
      answers: { interests: ['embedded', '3d_printing'] },
      text: { headline_note: 'hello' },
      links: { github_link: 'https://github.com/ada' },
      columns: { display_name: 'Ada' },
      retired: [{ fieldKey: 'gone_field', values: ['x'], text: null, retiredAt: '2026-01-01T00:00:00.000Z' }],
    };
    answerMap = { interests: ['embedded', '3d_printing'] };

    const res = (await personaGet(event())) as {
      sections: PersonaSection[];
      values: Record<string, unknown>;
      retired: unknown[];
      completeness: { filledFields: number; totalFields: number };
    };

    expect(server.getPersonaValues).toHaveBeenCalledWith({}, 'user-1', sections);
    expect(res.sections).toBe(sections);
    expect(res.values).toEqual({
      answers: storedValues.answers,
      text: storedValues.text,
      links: storedValues.links,
      columns: storedValues.columns,
    });
    expect(res.retired).toHaveLength(1);
    // `retired` is lifted OUT of `values`, not duplicated inside it.
    expect(res.values).not.toHaveProperty('retired');
    // One key in the answer map resolves to one filled field. Pinned relative to
    // the fixture, not to the size of the built-in registry, which is free to grow.
    expect(res.completeness.totalFields).toBeGreaterThan(0);
    expect(res.completeness.filledFields).toBe(1);
  });

  it('does not leak operator-only provenance or drift to a member', async () => {
    const res = (await personaGet(event())) as Record<string, unknown>;
    expect(Object.keys(res).sort()).toEqual(['completeness', 'retired', 'sections', 'values']);
  });
});

// --- PUT /api/persona ------------------------------------------------------------

describe('PUT /api/persona', () => {
  it('forwards the submission verbatim and does no business logic of its own', async () => {
    requestBody = { sectionKey: 'interests', answers: { interests: ['embedded'] } };
    await personaPut(event('PUT'));
    expect(server.setPersonaSection).toHaveBeenCalledTimes(1);
    expect(server.setPersonaSection).toHaveBeenCalledWith(
      {},
      { userId: 'user-1', sectionKey: 'interests', answers: { interests: ['embedded'] }, config: config() },
    );
  });

  it('a submission that omits EVERY answer still reaches setPersonaSection, so the section clears', async () => {
    // The regression this exists for: treating `answers: {}` as "nothing to do"
    // and returning early. The delete downstream is scoped to the section's
    // TEMPLATE, so an empty map is how a user unticks every box. Short-circuit
    // here and withdrawing an answer becomes impossible (plan 4.5, B13).
    requestBody = { sectionKey: 'interests', answers: {} };
    const res = (await personaPut(event('PUT'))) as { values: unknown };
    expect(server.setPersonaSection).toHaveBeenCalledTimes(1);
    const [, args] = server.setPersonaSection.mock.calls[0] as [unknown, { answers: unknown }];
    expect(args.answers).toEqual({});
    expect(res.values).toBe(storedValues);
  });

  it('an explicit null clears one field and is not stripped on the way through', async () => {
    requestBody = { sectionKey: 'basics', answers: { headline: null, pronouns: '' } };
    await personaPut(event('PUT'));
    const [, args] = server.setPersonaSection.mock.calls[0] as [unknown, { answers: Record<string, unknown> }];
    expect(args.answers).toEqual({ headline: null, pronouns: '' });
  });

  it('rejects an unknown field key with 400 and the field name in the error envelope', async () => {
    // The rejection itself is `setPersonaSection`'s (it holds the effective
    // template). What is asserted here is that the route surfaces it as a 400
    // carrying the offending key, in the same `data.errors` envelope `parseBody`
    // uses, rather than as a 200 or a bare 500.
    server.setPersonaSection.mockResolvedValueOnce({
      ok: false,
      error: 'Unknown field: not_a_field',
      fieldKey: 'not_a_field',
    });
    requestBody = { sectionKey: 'interests', answers: { not_a_field: 'x' } };
    await expect(personaPut(event('PUT'))).rejects.toMatchObject({
      statusCode: 400,
      data: { errors: { not_a_field: ['Unknown field: not_a_field'] } },
    });
  });

  it('an unknown SECTION key is a 400 keyed on sectionKey, never an unkeyed message', async () => {
    server.setPersonaSection.mockResolvedValueOnce({ ok: false, error: 'Unknown section: nope' });
    requestBody = { sectionKey: 'nope', answers: {} };
    await expect(personaPut(event('PUT'))).rejects.toMatchObject({
      statusCode: 400,
      data: { errors: { sectionKey: ['Unknown section: nope'] } },
    });
  });

  it.each([
    ['a missing sectionKey', { answers: {} }],
    ['a sectionKey with path characters', { sectionKey: '../admin', answers: {} }],
    ['a sectionKey with a quote', { sectionKey: "a'--", answers: {} }],
    ['an oversized sectionKey', { sectionKey: 'a'.repeat(41), answers: {} }],
    ['a non-object answers', { sectionKey: 'interests', answers: 'nope' }],
    ['a numeric answer value', { sectionKey: 'interests', answers: { interests: 3 } }],
    ['an unexpected extra top-level key', { sectionKey: 'interests', answers: {}, userId: 'someone-else' }],
  ])('rejects %s with 400 before any write', async (_name, body) => {
    requestBody = body;
    await expect(personaPut(event('PUT'))).rejects.toMatchObject({ statusCode: 400 });
    expect(server.setPersonaSection).not.toHaveBeenCalled();
  });

  it('writes only the authenticated viewer, never a userId from the body', async () => {
    // `.strict()` already rejects the extra key; this pins the reason it matters.
    requestBody = { sectionKey: 'interests', answers: {} };
    await personaPut(event('PUT'));
    const [, args] = server.setPersonaSection.mock.calls[0] as [unknown, { userId: string }];
    expect(args.userId).toBe('user-1');
  });
});

// --- GET /api/persona/status -----------------------------------------------------

describe('GET /api/persona/status', () => {
  const run = async (): Promise<{
    enabled: boolean;
    offer: boolean;
    hasAnyAnswer: boolean;
    completeness: { filled: number; total: number };
    dismissals: number;
  }> =>
    (await personaStatus(event('GET', '/api/persona/status'))) as {
      enabled: boolean;
      offer: boolean;
      hasAnyAnswer: boolean;
      completeness: { filled: number; total: number };
      dismissals: number;
    };

  it('offers the invitation to a user who has answered nothing', async () => {
    const res = await run();
    expect(res).toMatchObject({ enabled: true, hasAnyAnswer: false, offer: true, dismissals: 0 });
    expect(res.completeness.total).toBeGreaterThan(0);
    expect(res.completeness.filled).toBe(0);
  });

  it('a display name alone does NOT count as an answer', async () => {
    // A column-bound field is filled for very nearly every account, so counting
    // it as an answer would suppress the invitation universally and make the
    // banner dead code. It still counts toward the completeness METER.
    storedValues.columns = { display_name: 'Ada' };
    answerMap = { display_name: 'Ada' };
    const res = await run();
    expect(res.hasAnyAnswer).toBe(false);
    expect(res.offer).toBe(true);
    expect(res.completeness.filled).toBe(1);
  });

  it.each([
    ['a persona answer row', (): void => void (storedValues.answers = { interests: ['embedded'] })],
    ['a persona free-text row', (): void => void (storedValues.text = { note: 'hi' })],
    [
      'data left behind by a removed question',
      (): void => void (storedValues.retired = [{ fieldKey: 'gone', values: ['x'], text: null, retiredAt: null }]),
    ],
  ])('%s stops the invitation for good', async (_name, seed) => {
    seed();
    const res = await run();
    expect(res.hasAnyAnswer).toBe(true);
    expect(res.offer).toBe(false);
  });

  it('stops offering after the second dismissal, and the threshold lives on the server', async () => {
    cookies = { 'cpub-persona-invite-dismissed': '1' };
    expect((await run()).offer).toBe(true);
    cookies = { 'cpub-persona-invite-dismissed': '2' };
    const res = await run();
    expect(res.offer).toBe(false);
    expect(res.dismissals).toBe(2);
  });

  it.each([
    ['not a number', 'many'],
    ['negative', '-4'],
    ['empty', ''],
    ['float', '1.7'],
  ])('a %s dismissal cookie degrades to a count, never NaN', async (_name, raw) => {
    cookies = { 'cpub-persona-invite-dismissed': raw };
    const res = await run();
    expect(Number.isInteger(res.dismissals)).toBe(true);
    expect(res.dismissals).toBeGreaterThanOrEqual(0);
    expect(res.dismissals).toBeLessThanOrEqual(2);
  });

  it('clamps a hostile cookie rather than echoing it', async () => {
    // The cookie is client-writable. An unbounded number in the payload is a
    // value a client wrote, reflected back as if the server had counted it.
    cookies = { 'cpub-persona-invite-dismissed': '999999999' };
    expect((await run()).dismissals).toBe(2);
  });
});

// --- DELETE /api/persona/retired/[fieldKey] --------------------------------------

describe('DELETE /api/persona/retired/[fieldKey]', () => {
  const withRetired = (key: string): void => {
    storedValues.retired = [{ fieldKey: key, values: ['x'], text: null, retiredAt: null }];
  };

  it('deletes a key that IS in the viewer own retired set', async () => {
    withRetired('gone_field');
    routerParams = { fieldKey: 'gone_field' };
    const res = await retiredDelete(event('DELETE', '/api/persona/retired/gone_field'));
    expect(res).toEqual({ deleted: 3 });
    expect(server.deletePersonaFieldValue).toHaveBeenCalledWith({}, { userId: 'user-1', fieldKey: 'gone_field' });
  });

  it('refuses a shape-valid key the viewer has no retired data for, and never binds it', async () => {
    // DOMAIN, not shape. `other_users_field` passes every regex; it is refused
    // because it is not one of the keys we just read back for THIS user.
    withRetired('gone_field');
    routerParams = { fieldKey: 'other_users_field' };
    await expect(retiredDelete(event('DELETE', '/api/persona/retired/other_users_field'))).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(server.deletePersonaFieldValue).not.toHaveBeenCalled();
  });

  it('refuses a key that is still LIVE in the schema, so the retired door cannot reach a live field', async () => {
    const live = sections[0]?.fields[0]?.key;
    expect(live, 'the builtin schema must have at least one field for this to mean anything').toBeTruthy();
    routerParams = { fieldKey: live as string };
    await expect(retiredDelete(event('DELETE', `/api/persona/retired/${live}`))).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(server.deletePersonaFieldValue).not.toHaveBeenCalled();
  });

  it.each([
    ['a path traversal', '../../admin'],
    ['a SQL-shaped string', "x' OR '1'='1"],
    ['an uppercase key', 'GoneField'],
    ['a hyphenated key', 'gone-field'],
    ['an oversized key', 'a'.repeat(41)],
    ['a malformed percent escape', '%zz'],
    ['a null byte', 'gone\u0000field'],
    ['an embedded space', 'gone field'],
    ['a LIKE wildcard', 'gone_%'],
  ])('rejects %s with 400 before any query runs', async (_name, key) => {
    routerParams = { fieldKey: key };
    await expect(retiredDelete(event('DELETE', '/api/persona/retired/x'))).rejects.toMatchObject({ statusCode: 400 });
    expect(server.effectivePersonaSchema).not.toHaveBeenCalled();
    expect(server.deletePersonaFieldValue).not.toHaveBeenCalled();
  });

  it('a missing param is a 400, not a 500', async () => {
    routerParams = {};
    await expect(retiredDelete(event('DELETE', '/api/persona/retired/'))).rejects.toMatchObject({ statusCode: 400 });
  });

  it('percent-encoded keys are decoded before the domain check', async () => {
    withRetired('gone_field');
    routerParams = { fieldKey: 'gone%5Ffield' };
    await expect(retiredDelete(event('DELETE', '/api/persona/retired/gone%5Ffield'))).resolves.toEqual({ deleted: 3 });
  });
});

// --- Static contract sweep, with a discovery guard (P7) --------------------------

describe('persona route contract', () => {
  const apiDir = resolve(__dirname, '..');
  const FILES = [
    'persona.get.ts',
    'persona.put.ts',
    'persona/status.get.ts',
    'persona/retired/[fieldKey].delete.ts',
  ] as const;

  const sources = FILES.map((rel) => [rel, readFileSync(resolve(apiDir, rel), 'utf8')] as const);

  it('read every route file, and none of them is empty', () => {
    expect(sources).toHaveLength(4);
    for (const [rel, src] of sources) {
      expect(src.length, `${rel} must not be empty`).toBeGreaterThan(200);
    }
  });

  it('every route that reads or writes persona DATA is flag-gated', () => {
    const gated = sources.filter(([rel]) => rel !== 'persona/status.get.ts');
    expect(gated).toHaveLength(3);
    for (const [rel, src] of gated) {
      expect(src, `${rel} must requireFeature('persona')`).toMatch(/requireFeature\(\s*['"]persona['"]\s*\)/);
    }
  });

  it('every route requires a logged-in user', () => {
    for (const [rel, src] of sources) {
      expect(src, `${rel} must requireAuth(event)`).toMatch(/requireAuth\(\s*event\s*\)/);
    }
  });

  it('no route accepts a user identifier from the client', () => {
    for (const [rel, src] of sources) {
      expect(src, `${rel} must not read a userId from the body or query`).not.toMatch(
        /body\.userId|query\.userId|getQuery\(/,
      );
    }
  });

  it('the write route delegates rather than reimplementing the partition', () => {
    const put = sources.find(([rel]) => rel === 'persona.put.ts')?.[1] ?? '';
    expect(put).toMatch(/setPersonaSection\(/);
    // No sink routing, no direct table access, no transaction of its own.
    expect(put).not.toMatch(/personaFieldSink|userPersonaAnswers|userPersonaText|db\.transaction/);
  });
});

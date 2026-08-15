/**
 * Behavioural tests for `GET /api/persona/links` and `PUT /api/persona/links`,
 * the per-platform link sharing pair (plan phase 3, R3.1 D6).
 *
 * Same harness as `persona-routes.test.ts` next door: the Nitro auto-imports go
 * on `globalThis` BEFORE the handlers are imported, and `requireAuth`,
 * `requireFeature` and `parseBody` are the ACTUAL implementations from
 * `server/utils/`, so a 404/401/400 assertion here is a statement about shipped
 * code rather than about a stub. Only `@commonpub/server` is doubled, since its
 * transaction, row lock and template-scoped delete have their own integration
 * suite against a database.
 *
 * The questions worth asking of these two routes cannot be answered by reading
 * the source: whether a platform with no address really produces no row, whether
 * an EMPTY platform list really reaches the writer instead of being
 * short-circuited as "nothing to do", and whether `sharingOffered` is really
 * false on an instance that has the flag on but has declared no recipient.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommonPubConfig } from '@commonpub/config';

// --- @commonpub/server doubles ---------------------------------------------------

const server = vi.hoisted(() => ({
  effectivePersonaLinkPlatforms: vi.fn(),
  effectivePersonaSchema: vi.fn(),
  effectiveDataSharingDocument: vi.fn(),
  currentPurposeScope: vi.fn(),
  listSharedLinkPlatforms: vi.fn(),
  setSharedLinkPlatforms: vi.fn(),
}));
vi.mock('@commonpub/server', () => server);

// --- mutable request state -------------------------------------------------------

interface HttpErrorInit {
  statusCode: number;
  statusMessage: string;
  data?: unknown;
}
interface HttpError extends Error, HttpErrorInit {}

let personaFlag = true;
let sharingFlag = true;
let authUser: { id: string; username: string; role: string; email: string; emailVerified: boolean } | null = null;
let requestBody: unknown = {};
/** What `users.social_links` holds for the viewer. */
let socialLinks: Record<string, unknown> | null = {};
let sharedPlatforms: string[] = [];
/** What `currentPurposeScope` reports as offerable, by data class. */
let scopeDataClasses: string[] = [];
/** Every `select()` the handlers issued, so "did it touch the DB at all" is answerable. */
let selectCalls = 0;

const PLATFORMS = [
  { key: 'github', label: 'GitHub', hostSuffixes: ['github.com'], placeholder: '', authenticitySignal: true },
  { key: 'mastodon', label: 'Mastodon', hostSuffixes: [], placeholder: '', authenticitySignal: false },
  { key: 'linkedin', label: 'LinkedIn', hostSuffixes: ['linkedin.com'], placeholder: '', authenticitySignal: true },
];

function config(): CommonPubConfig {
  return {
    features: { persona: personaFlag, dataSharingConsents: sharingFlag },
  } as unknown as CommonPubConfig;
}

interface FakeEvent {
  context: { auth?: { user: unknown } };
  method: string;
  path: string;
}

function event(method = 'GET'): FakeEvent {
  return {
    context: authUser === null ? {} : { auth: { user: authUser } },
    method,
    path: '/api/persona/links',
  };
}

/** `select().from().where().limit()`, the only shape these routes use. */
function fakeDb(): Record<string, unknown> {
  return {
    select: () => {
      selectCalls += 1;
      return {
        from: () => ({
          where: () => ({
            limit: async (): Promise<Array<{ socialLinks: unknown }>> => [{ socialLinks }],
          }),
        }),
      };
    },
  };
}

// --- Nitro auto-imports, installed before the handlers are loaded ----------------

function createErrorStub(init: HttpErrorInit): HttpError {
  return Object.assign(new Error(init.statusMessage), init) as HttpError;
}

Object.assign(globalThis, {
  defineEventHandler: <T>(handler: T): T => handler,
  createError: createErrorStub,
  useDB: (): Record<string, unknown> => fakeDb(),
  useConfig: (): CommonPubConfig => config(),
  getRequestHeader: (): string | undefined => undefined,
  readRawBody: async (): Promise<string> => JSON.stringify(requestBody),
  readBody: async (): Promise<unknown> => requestBody,
});

const validate = await import('../../utils/validate');
const auth = await import('../../utils/auth');
Object.assign(globalThis, {
  requireFeature: validate.requireFeature,
  parseBody: validate.parseBody,
  requireAuth: auth.requireAuth,
});

interface LinkRow {
  key: string;
  label: string;
  url: string;
  shared: boolean;
}
interface LinkPayload {
  platforms: LinkRow[];
  sharingOffered: boolean;
}

type Handler = (e: FakeEvent) => Promise<LinkPayload>;
const linksGet = (await import('../persona/links.get')).default as unknown as Handler;
const linksPut = (await import('../persona/links.put')).default as unknown as Handler;

beforeEach(() => {
  vi.clearAllMocks();
  personaFlag = true;
  sharingFlag = true;
  authUser = { id: 'user-1', username: 'ada', role: 'user', email: 'ada@example.com', emailVerified: true };
  requestBody = { platforms: [] };
  socialLinks = { github: 'https://github.com/ada', mastodon: 'https://hachyderm.io/@ada' };
  sharedPlatforms = ['mastodon'];
  scopeDataClasses = ['persona_selections', 'profile_links', 'public_identity'];
  selectCalls = 0;

  server.effectivePersonaLinkPlatforms.mockImplementation(async () => PLATFORMS);
  server.effectivePersonaSchema.mockImplementation(async () => ({ sections: [], source: 'builtin', savedAt: null, drift: [] }));
  server.effectiveDataSharingDocument.mockImplementation(async () => ({}));
  server.currentPurposeScope.mockImplementation(async () => ({ dataClasses: scopeDataClasses }));
  server.listSharedLinkPlatforms.mockImplementation(async () => sharedPlatforms);
  server.setSharedLinkPlatforms.mockImplementation(async (_db: unknown, args: { platforms: string[] }) => {
    sharedPlatforms = [...args.platforms];
    return { ok: true, platforms: sharedPlatforms };
  });
});

it('both handlers loaded (a broken import path would otherwise skip every assertion)', () => {
  expect(typeof linksGet).toBe('function');
  expect(typeof linksPut).toBe('function');
});

// --- Gates -----------------------------------------------------------------------

describe('gates', () => {
  it.each([
    ['GET', (): Promise<unknown> => linksGet(event())],
    ['PUT', (): Promise<unknown> => linksPut(event('PUT'))],
  ])('%s is 404 when persona is off, before anything touches the database', async (_m, call) => {
    personaFlag = false;
    await expect(call()).rejects.toMatchObject({ statusCode: 404 });
    expect(selectCalls).toBe(0);
    expect(server.setSharedLinkPlatforms).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', (): Promise<unknown> => linksGet(event())],
    ['PUT', (): Promise<unknown> => linksPut(event('PUT'))],
  ])('%s is 401 for a signed-out caller', async (_m, call) => {
    authUser = null;
    await expect(call()).rejects.toMatchObject({ statusCode: 401 });
  });

  /**
   * Gated on `persona`, NOT on `dataSharingConsents`, and the asymmetry is
   * deliberate: a member's stored refusal must outlive an operator toggling the
   * sharing flag off to revise recipient copy and on again. A route that 404s in
   * between would tempt a client into reading "cannot load" as "shares nothing".
   */
  it('still answers when the sharing flag is off, and says sharing is not offered', async () => {
    sharingFlag = false;
    const body = await linksGet(event());
    expect(body.sharingOffered).toBe(false);
    expect(body.platforms.map((p) => p.key)).toEqual(['github', 'mastodon']);
  });

  it('still accepts a write when the sharing flag is off', async () => {
    sharingFlag = false;
    requestBody = { platforms: ['github'] };
    await expect(linksPut(event('PUT'))).resolves.toBeDefined();
    expect(server.setSharedLinkPlatforms).toHaveBeenCalled();
  });
});

// --- What the read returns --------------------------------------------------------

describe('GET /api/persona/links', () => {
  it('returns only platforms the member has actually filled in', async () => {
    const body = await linksGet(event());
    // LinkedIn is a declared platform with no stored address: no row, no toggle.
    expect(body.platforms.map((p) => p.key)).toEqual(['github', 'mastodon']);
  });

  it('keeps the operator platform order, not the order the addresses were stored in', async () => {
    socialLinks = { mastodon: 'https://hachyderm.io/@ada', github: 'https://github.com/ada' };
    const body = await linksGet(event());
    expect(body.platforms.map((p) => p.key)).toEqual(['github', 'mastodon']);
  });

  it('is off by default: a platform with no row is not shared', async () => {
    sharedPlatforms = [];
    const body = await linksGet(event());
    expect(body.platforms.every((p) => p.shared === false)).toBe(true);
  });

  it('reports shared exactly for the platforms with a row', async () => {
    const body = await linksGet(event());
    expect(body.platforms.find((p) => p.key === 'mastodon')?.shared).toBe(true);
    expect(body.platforms.find((p) => p.key === 'github')?.shared).toBe(false);
  });

  it('returns no row at all when the member has filled nothing in', async () => {
    socialLinks = {};
    const body = await linksGet(event());
    expect(body.platforms).toEqual([]);
  });

  it('survives a legacy row whose social_links is null or not an object', async () => {
    socialLinks = null;
    await expect(linksGet(event())).resolves.toMatchObject({ platforms: [] });
  });

  it('ignores an empty or whitespace address, which is not a filled-in link', async () => {
    socialLinks = { github: '   ', mastodon: '' };
    const body = await linksGet(event());
    expect(body.platforms).toEqual([]);
  });

  it('ignores a non-string value rather than printing it', async () => {
    socialLinks = { github: 42, mastodon: { url: 'x' } };
    const body = await linksGet(event());
    expect(body.platforms).toEqual([]);
  });

  /**
   * `sharingOffered` is DERIVED, not declared twice. A flag with no declared
   * recipient offers nothing, so the control must not render, and the server is
   * the only thing that knows.
   */
  it('is not offered when no offerable purpose covers profile_links', async () => {
    scopeDataClasses = ['persona_selections'];
    const body = await linksGet(event());
    expect(body.sharingOffered).toBe(false);
  });

  it('is offered when the flag is on and a purpose covering profile_links is offerable', async () => {
    const body = await linksGet(event());
    expect(body.sharingOffered).toBe(true);
  });

  it('resolves the scope through the persona registry, not the config file alone', async () => {
    // Without the `sections` resolver the digest is computed over the file's
    // sections while everything else uses the DB-resolved ones.
    await linksGet(event());
    const resolvers = server.currentPurposeScope.mock.calls[0]?.[2] as
      | { sections?: unknown; dataSharing?: unknown }
      | undefined;
    expect(typeof resolvers?.sections).toBe('function');
    expect(resolvers?.dataSharing).toBe(server.effectiveDataSharingDocument);
  });

  it('reads the sharing rows of the CALLER, never of anybody else', async () => {
    await linksGet(event());
    expect(server.listSharedLinkPlatforms).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });
});

// --- What the write does ----------------------------------------------------------

describe('PUT /api/persona/links', () => {
  it('hands the whole submitted set to the writer, with the caller as the subject', async () => {
    requestBody = { platforms: ['github', 'mastodon'] };
    await linksPut(event('PUT'));
    expect(server.setSharedLinkPlatforms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'user-1', platforms: ['github', 'mastodon'] }),
    );
  });

  /**
   * The withdrawal path. An empty list is a valid and meaningful request: it
   * clears every platform. A route that treated it as "nothing to do" would
   * make turning the last one off impossible, which is a data-subject-rights
   * bug wearing an off-by-one costume.
   */
  it('passes an EMPTY list through rather than short-circuiting it', async () => {
    sharedPlatforms = ['github', 'mastodon'];
    requestBody = { platforms: [] };
    const body = await linksPut(event('PUT'));
    expect(server.setSharedLinkPlatforms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ platforms: [] }),
    );
    expect(body.platforms.every((p) => p.shared === false)).toBe(true);
  });

  it('answers with the full payload, so the client re-renders from the server', async () => {
    requestBody = { platforms: ['github'] };
    const body = await linksPut(event('PUT'));
    expect(body.platforms.find((p) => p.key === 'github')?.shared).toBe(true);
    expect(body.platforms.find((p) => p.key === 'mastodon')?.shared).toBe(false);
    expect(body.sharingOffered).toBe(true);
  });

  it('rejects an unknown platform with the same envelope a Zod failure produces', async () => {
    server.setSharedLinkPlatforms.mockImplementation(async () => ({
      ok: false,
      error: '"myspace" is not a link platform on this instance',
      platform: 'myspace',
    }));
    requestBody = { platforms: ['myspace'] };
    await expect(linksPut(event('PUT'))).rejects.toMatchObject({
      statusCode: 400,
      data: { errors: { platforms: ['"myspace" is not a link platform on this instance'] } },
    });
  });

  it.each([
    ['a missing platforms key', {}],
    ['a string instead of a list', { platforms: 'github' }],
    ['an unknown extra key', { platforms: [], sneaky: true }],
    ['a key longer than the column holds', { platforms: ['x'.repeat(33)] }],
  ])('rejects %s before anything reaches the writer', async (_name, body) => {
    requestBody = body;
    await expect(linksPut(event('PUT'))).rejects.toMatchObject({ statusCode: 400 });
    expect(server.setSharedLinkPlatforms).not.toHaveBeenCalled();
  });
});

// --- Source contract --------------------------------------------------------------

describe('source contract', () => {
  const apiRoot = resolve(__dirname, '..');
  const get = readFileSync(resolve(apiRoot, 'persona/links.get.ts'), 'utf8');
  const put = readFileSync(resolve(apiRoot, 'persona/links.put.ts'), 'utf8');

  it('read both routes it is auditing', () => {
    expect(get.length).toBeGreaterThan(2000);
    expect(put.length).toBeGreaterThan(1000);
  });

  it('the write goes through the server function, never through a hand-rolled query', () => {
    const code = put.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    expect(code).toContain('setSharedLinkPlatforms');
    // The transaction, the row lock and the template-scoped delete live in
    // `@commonpub/server`. A second writer would be a second chance to disagree
    // about what "untick everything" means.
    expect(code).not.toContain('db.delete');
    expect(code).not.toContain('db.insert');
    expect(code).not.toContain('userSharedLinks');
  });

  it('neither route reads or writes a single URL', () => {
    // This is a sharing control, not a link editor. `/settings/profile` owns the
    // addresses; a write here that touched `social_links` would be a second
    // editor for one column.
    for (const [name, src] of [['links.get.ts', get], ['links.put.ts', put]] as const) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
      expect(code, name).not.toContain('.set(');
      expect(code, name).not.toContain('setPersonaSection');
    }
  });
});

/**
 * A minimal Nitro harness for the persona route handlers.
 *
 * The layer's other route tests read source strings, which cannot tell a 403
 * from a 404 and cannot see the ORDER two guards run in. These routes turn on
 * exactly that: `read:*` must be refused where `read:analytics` is accepted, a
 * disabled flag must 404 rather than 403 so the surface stays invisible, and a
 * stale `If-Match` must 409 rather than silently overwriting another operator's
 * save. So this harness invokes the real handlers.
 *
 * What it fakes and what it does NOT:
 *
 * - FAKED: the h3 request primitives (`getQuery`, `getHeader`, `readBody`, ...),
 *   `useDB`, `useConfig`, `requireAuth` and `requirePermission`. All of those are
 *   request plumbing or are already covered by the admin permission sweeps.
 * - REAL: `requireFeature`, `parseBody`, `parseParams` and `parseQueryParams`
 *   come from `server/utils/validate.ts`, and `requireApiScope` from
 *   `server/utils/requireScope.ts`, which calls the real `hasScope`. A test that
 *   reimplemented the guard it is checking would prove nothing, so the guards are
 *   the shipped ones.
 *
 * `defineEventHandler` is stubbed as identity, which is what makes the exported
 * default of a route file directly callable.
 */
import { vi } from 'vitest';

/** Stands in for h3's `H3Error`: a real Error carrying the status fields. */
export class StubHttpError extends Error {
  readonly statusCode: number;
  readonly statusMessage: string;
  readonly data: unknown;

  constructor(input: { statusCode?: number; statusMessage?: string; data?: unknown }) {
    super(input.statusMessage ?? 'Error');
    this.name = 'StubHttpError';
    this.statusCode = input.statusCode ?? 500;
    this.statusMessage = input.statusMessage ?? 'Error';
    this.data = input.data;
  }
}

export interface HarnessUser {
  id: string;
  role: string;
}

export interface HarnessState {
  /** Read by the stubbed `useConfig()`, and therefore by the real `requireFeature`. */
  features: Record<string, boolean>;
  /** Everything else `useConfig()` returns (`persona`, `dataSharing`, `instance`, ...). */
  config: Record<string, unknown>;
  db: unknown;
  user: HarnessUser | null;
  permissions: string[];
  /** `undefined` means "not an API-key request at all", which is a 401. */
  apiScopes: string[] | undefined;
}

const DEFAULT_FEATURES: Record<string, boolean> = {
  admin: true,
  publicApi: true,
  persona: true,
  personaAnalytics: true,
  dataSharingConsents: true,
  // `memberDirectory` is deliberately ABSENT. Its shipped default is off, it is
  // the only flag here that discloses identified people, and the directory route
  // tests set it per-case and assert this absence, so a harness default of `true`
  // would quietly make "the flag is off" untestable.
};

export const harness: HarnessState = {
  features: { ...DEFAULT_FEATURES },
  config: {},
  db: { __stub: 'db' },
  user: { id: 'admin-1', role: 'admin' },
  permissions: ['settings.manage', 'audit.read'],
  apiScopes: ['read:audience'],
};

export function resetHarness(): void {
  harness.features = { ...DEFAULT_FEATURES };
  harness.config = {};
  harness.db = { __stub: 'db' };
  harness.user = { id: 'admin-1', role: 'admin' };
  harness.permissions = ['settings.manage', 'audit.read'];
  harness.apiScopes = ['read:audience'];
}

export interface StubEvent {
  method: string;
  path: string;
  context: Record<string, unknown>;
  query: Record<string, string>;
  headers: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

export function makeEvent(init: Partial<StubEvent> = {}): StubEvent {
  return {
    method: init.method ?? 'GET',
    path: init.path ?? '/api/test',
    context: { ...(init.context ?? {}), apiScopes: harness.apiScopes },
    query: init.query ?? {},
    // Header lookups are case-insensitive in h3; normalise once here so a test
    // can write `If-Match` and the handler can read `if-match`.
    headers: Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    params: init.params ?? {},
    body: init.body,
  };
}

type Handler = (event: StubEvent) => unknown;

/** Assert a handler rejects with a specific status, and hand back the error. */
export async function expectStatus(
  handler: Handler,
  event: StubEvent,
): Promise<StubHttpError | null> {
  try {
    await handler(event);
    return null;
  } catch (err) {
    if (err instanceof StubHttpError) return err;
    throw err;
  }
}

let installed = false;

/**
 * Install the auto-imported globals a Nitro route expects.
 *
 * Idempotent, so every test file can call it in `beforeAll` without fighting
 * over the global object.
 *
 * @param withApiScope import the real `requireApiScope`. It pulls `hasScope`
 *   from `@commonpub/server`, so an admin-only suite leaves it off rather than
 *   paying for that module graph.
 */
export async function installNitroStubs(withApiScope = false): Promise<void> {
  const g = globalThis as unknown as Record<string, unknown>;

  if (!installed) {
    g.defineEventHandler = <T>(handler: T): T => handler;
    g.defineNitroPlugin = <T>(handler: T): T => handler;
    g.createError = (input: { statusCode?: number; statusMessage?: string; data?: unknown }) =>
      new StubHttpError(input);
    g.getQuery = (event: StubEvent): Record<string, string> => event.query;
    g.getHeader = (event: StubEvent, name: string): string | undefined =>
      event.headers[name.toLowerCase()];
    g.getRequestHeader = g.getHeader;
    g.getRouterParam = (event: StubEvent, name: string): string | undefined => event.params[name];
    g.readRawBody = async (event: StubEvent): Promise<string> =>
      JSON.stringify(event.body ?? null);
    g.readBody = async (event: StubEvent): Promise<unknown> => event.body;
    g.getRequestIP = (): string => '203.0.113.7';
    g.useDB = (): unknown => harness.db;
    g.useConfig = (): unknown => ({ ...harness.config, features: harness.features });
    g.requireAuth = (): HarnessUser => {
      if (harness.user === null) {
        throw new StubHttpError({ statusCode: 401, statusMessage: 'Authentication required' });
      }
      return harness.user;
    };
    g.requirePermission = (_event: StubEvent, needed: string): HarnessUser => {
      const user = (g.requireAuth as () => HarnessUser)();
      if (!harness.permissions.includes(needed)) {
        throw new StubHttpError({
          statusCode: 403,
          statusMessage: `Missing permission: ${needed}`,
        });
      }
      return user;
    };
    // Route-level validation is the REAL implementation, not a copy: these are
    // the functions whose 400/404 behaviour the tests are about.
    const validate = await import('../server/utils/validate');
    g.requireFeature = validate.requireFeature;
    g.parseBody = validate.parseBody;
    g.parseParams = validate.parseParams;
    g.parseQueryParams = validate.parseQueryParams;
    installed = true;
  }

  if (withApiScope && g.requireApiScope === undefined) {
    const requireScope = await import('../server/utils/requireScope');
    g.requireApiScope = requireScope.requireApiScope;
  }

  // `console.warn` is called by the real `parseBody` on every rejected body.
  // Silencing it keeps the deliberate-failure tests readable.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
}

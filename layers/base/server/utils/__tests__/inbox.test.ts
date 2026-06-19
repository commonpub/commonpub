/**
 * Unit tests for the HTTP-signature inbox glue in `server/utils/inbox.ts`.
 *
 * Scope is the GLUE, not protocol's signature math: keyId↔actor host binding,
 * the 5-minute Date-skew window, keyId extraction, body-size limit, and the
 * happy path. The crypto/network boundary (`verifyHttpSignature`, `resolveActor`)
 * is mocked via `vi.mock('@commonpub/protocol')`; Nitro auto-imports
 * (`getHeader`, `readRawBody`, `getRequestURL`, `getHeaders`, `createError`) are
 * referenced as globals and installed on `globalThis` (same pattern as
 * assertActorMatchesSigner.test.ts / parseBody-size-limit.test.ts).
 *
 * `assertActorMatchesSigner` has its own focused suite
 * (assertActorMatchesSigner.test.ts); here we re-cover only its host-binding
 * contract as the task asks, alongside verifyInboxRequest.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { H3Event } from 'h3';

const verifyHttpSignature = vi.fn<(...args: unknown[]) => Promise<boolean>>();
const resolveActor = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock('@commonpub/protocol', () => ({
  verifyHttpSignature: (...args: unknown[]) => verifyHttpSignature(...args),
  resolveActor: (...args: unknown[]) => resolveActor(...args),
}));

interface HttpError extends Error {
  statusCode: number;
  statusMessage: string;
}

// Per-test request state the global stand-ins read from.
let headers: Record<string, string>;
let rawBody: string | undefined;

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  g.createError = (opts: { statusCode: number; statusMessage: string }): HttpError => {
    const e = new Error(opts.statusMessage) as HttpError;
    e.statusCode = opts.statusCode;
    e.statusMessage = opts.statusMessage;
    return e;
  };
  g.getHeader = (_event: H3Event, name: string): string | undefined => headers[name.toLowerCase()];
  g.getHeaders = (_event: H3Event): Record<string, string> => headers;
  g.getRequestURL = (_event: H3Event): URL => new URL('https://local.example/inbox');
  g.readRawBody = async (_event: H3Event, _enc: false): Promise<string | undefined> => rawBody;
  // inbox.ts passes `fetch` straight to resolveActor (which we mock), so it is
  // never actually invoked, but the identifier must resolve.
  if (typeof g.fetch === 'undefined') g.fetch = (): never => { throw new Error('fetch should not be called'); };
});

const { verifyInboxRequest, assertActorMatchesSigner } = await import('../inbox');

const REMOTE = 'https://remote.example';
const ACTOR_URI = `${REMOTE}/actor`;
const KEY_ID = `${ACTOR_URI}#main-key`;
const PUBKEY = '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----';

/** A well-formed, fresh, same-host request that should pass when the signature verifies. */
function happyHeaders(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
  return {
    signature: `keyId="${KEY_ID}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="abc"`,
    date: new Date().toUTCString(),
    'content-length': '20',
    ...overrides,
  };
}

beforeEach(() => {
  verifyHttpSignature.mockReset();
  resolveActor.mockReset();
  headers = happyHeaders();
  rawBody = JSON.stringify({ type: 'Create', actor: ACTOR_URI });
  // Default mocks: actor resolves on its own host, signature valid.
  resolveActor.mockResolvedValue({ id: ACTOR_URI, publicKey: { publicKeyPem: PUBKEY } });
  verifyHttpSignature.mockResolvedValue(true);
});

const fakeEvent = {} as H3Event;

describe('verifyInboxRequest — happy path', () => {
  it('returns { actorUri, body } for a fresh, same-host, validly-signed request', async () => {
    const result = await verifyInboxRequest(fakeEvent, 'test');
    expect(result.actorUri).toBe(ACTOR_URI);
    expect(result.body).toMatchObject({ type: 'Create', actor: ACTOR_URI });
    // keyId fragment is stripped to derive the actor URI used for resolution.
    expect(resolveActor).toHaveBeenCalledWith(ACTOR_URI, expect.anything());
  });
});

describe('verifyInboxRequest — keyId / actor host binding', () => {
  it('rejects when the resolved actor.id is on a DIFFERENT host than the keyId (spoof)', async () => {
    resolveActor.mockResolvedValue({ id: 'https://victim.example/actor', publicKey: { publicKeyPem: PUBKEY } });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a Signature header with no keyId', async () => {
    headers = happyHeaders({ signature: 'algorithm="rsa-sha256",signature="abc"' });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects when the Signature header is missing entirely', async () => {
    headers = happyHeaders();
    delete headers.signature;
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects when the actor public key cannot be resolved', async () => {
    resolveActor.mockResolvedValue({ id: ACTOR_URI, publicKey: null });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('verifyInboxRequest — Date skew window (±5 min)', () => {
  it('rejects a stale Date header (older than 5 minutes)', async () => {
    headers = happyHeaders({ date: new Date(Date.now() - 6 * 60 * 1000).toUTCString() });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a future Date header (more than 5 minutes ahead)', async () => {
    headers = happyHeaders({ date: new Date(Date.now() + 6 * 60 * 1000).toUTCString() });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('accepts a Date header within the 5-minute window', async () => {
    headers = happyHeaders({ date: new Date(Date.now() - 4 * 60 * 1000).toUTCString() });
    await expect(verifyInboxRequest(fakeEvent, 'test')).resolves.toMatchObject({ actorUri: ACTOR_URI });
  });

  it('rejects a missing Date header', async () => {
    headers = happyHeaders();
    delete headers.date;
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an unparseable Date header', async () => {
    headers = happyHeaders({ date: 'not a date' });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('verifyInboxRequest — body + signature', () => {
  it('rejects when the declared Content-Length exceeds 1MB', async () => {
    headers = happyHeaders({ 'content-length': String(1_048_577) });
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 413 });
  });

  it('rejects an empty body', async () => {
    rawBody = '';
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an invalid JSON body', async () => {
    rawBody = '{ not json';
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects when the cryptographic signature does not verify', async () => {
    verifyHttpSignature.mockResolvedValue(false);
    await expect(verifyInboxRequest(fakeEvent, 'test')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('assertActorMatchesSigner — host-binding contract (re-covered)', () => {
  it('accepts a same-host actor and rejects a cross-host actor', () => {
    expect(() => assertActorMatchesSigner(ACTOR_URI, { actor: `${REMOTE}/users/bob` }, 't')).not.toThrow();
    expect(() => assertActorMatchesSigner(ACTOR_URI, { actor: 'https://victim.example/actor' }, 't'))
      .toThrow(/does not match request signer/);
  });
});

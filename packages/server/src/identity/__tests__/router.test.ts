import { describe, it, expect, vi } from 'vitest';
import type {
  Identity,
  LinkedIdentity,
  NativeIdentity,
  Scope,
} from '@commonpub/auth';
import {
  run,
  ActionUnavailable,
  InsufficientScopes,
  LinkedIdentityRevoked,
  type ActionRoute,
} from '../router.js';

// Tests use `unknown` for the event type — framework-agnostic. Layer
// code will instantiate ActionRoute<H3Event, ...> with a real event.
type TestEvent = unknown;
const fakeEvent: TestEvent = {};

const NATIVE: NativeIdentity = {
  kind: 'native',
  id: 'u1',
  userId: 'u1',
  username: 'moheeb',
  instance: 'deveco.io',
  actorUri: 'https://deveco.io/users/moheeb',
  handle: '@moheeb@deveco.io',
};

function makeLinked(overrides: Partial<LinkedIdentity> = {}): LinkedIdentity {
  return {
    kind: 'linked',
    id: 'fa1',
    userId: 'u1',
    username: 'moheeb',
    instance: 'commonpub.io',
    actorUri: 'https://commonpub.io/users/moheeb',
    handle: '@moheeb@commonpub.io',
    scopes: ['read', 'write'] as Scope[],
    softwareKind: 'cpub',
    revokedAt: null,
    ...overrides,
  };
}

function makeAction<TIn = void, TOut = string>(opts: {
  name?: string;
  scopes?: ReadonlyArray<Scope>;
  local?: ActionRoute<TestEvent, TIn, TOut>['local'];
  remote?: ActionRoute<TestEvent, TIn, TOut>['remote'];
} = {}): ActionRoute<TestEvent, TIn, TOut> {
  return {
    name: opts.name ?? 'test-action',
    scopes: opts.scopes ?? [],
    local: opts.local ?? (vi.fn(async () => 'local-result' as TOut) as unknown as ActionRoute<TestEvent, TIn, TOut>['local']),
    remote: opts.remote,
  };
}

describe('run() — native identity', () => {
  it('dispatches to action.local', async () => {
    const local = vi.fn(async () => 'OK');
    const action = makeAction({ local });
    const result = await run(fakeEvent, NATIVE, action, undefined);
    expect(result).toBe('OK');
    expect(local).toHaveBeenCalledOnce();
    expect(local).toHaveBeenCalledWith(fakeEvent, NATIVE, undefined);
  });

  it('passes input through unchanged', async () => {
    const local = vi.fn(async (_e: TestEvent, _id, x: { hello: string }) => x.hello);
    const action: ActionRoute<TestEvent, { hello: string }, string> = {
      name: 'test',
      scopes: [],
      local,
    };
    const result = await run(fakeEvent, NATIVE, action, { hello: 'world' });
    expect(result).toBe('world');
  });

  it('does NOT check scopes for native (scopes are linked-only)', async () => {
    const action = makeAction({ scopes: ['publish'] });
    // Native passes through even though "scopes: ['publish']" is declared.
    const result = await run(fakeEvent, NATIVE, action, undefined);
    expect(result).toBe('local-result');
  });
});

describe('run() — linked identity', () => {
  it('throws ActionUnavailable when the action has no remote half', async () => {
    const action = makeAction(); // no remote
    await expect(run(fakeEvent, makeLinked(), action, undefined))
      .rejects.toBeInstanceOf(ActionUnavailable);
    await expect(run(fakeEvent, makeLinked(), action, undefined))
      .rejects.toMatchObject({ action: 'test-action', reason: 'not-proxiable' });
  });

  it('throws LinkedIdentityRevoked when the grant is revoked', async () => {
    const remote = vi.fn(async () => 'remote-result');
    const action = makeAction({ remote });
    const revoked = makeLinked({ revokedAt: new Date() });
    await expect(run(fakeEvent, revoked, action, undefined))
      .rejects.toBeInstanceOf(LinkedIdentityRevoked);
    expect(remote).not.toHaveBeenCalled();
  });

  it('throws InsufficientScopes when granted scopes do not cover required', async () => {
    const remote = vi.fn(async () => 'remote-result');
    const action = makeAction({ scopes: ['publish'], remote });
    const linked = makeLinked({ scopes: ['read', 'write'] });
    try {
      await run(fakeEvent, linked, action, undefined);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientScopes);
      expect((err as InsufficientScopes).required).toEqual(['publish']);
      expect((err as InsufficientScopes).granted).toEqual(['read', 'write']);
    }
    expect(remote).not.toHaveBeenCalled();
  });

  it('throws ActionUnavailable("phase-1a-foundation-only" path) when reaching getFediClient stub', async () => {
    // Phase 1a: getFediClient is intentionally unimplemented. With
    // valid scopes + a non-revoked grant, we should reach the client
    // construction and surface the stub error. Phase 1b removes this.
    const remote = vi.fn(async () => 'remote-result');
    const action = makeAction({ scopes: ['read'], remote });
    const linked = makeLinked({ scopes: ['read', 'write'] });
    await expect(run(fakeEvent, linked, action, undefined))
      .rejects.toThrow(/Phase 1b/);
    expect(remote).not.toHaveBeenCalled();
  });
});

describe('error classes', () => {
  it('ActionUnavailable carries action + reason', () => {
    const e = new ActionUnavailable('publish', 'no-token');
    expect(e.name).toBe('ActionUnavailable');
    expect(e.action).toBe('publish');
    expect(e.reason).toBe('no-token');
    expect(e.message).toContain('publish');
    expect(e.message).toContain('no-token');
  });

  it('InsufficientScopes carries required + granted', () => {
    const e = new InsufficientScopes('publish', ['publish'], ['read']);
    expect(e.required).toEqual(['publish']);
    expect(e.granted).toEqual(['read']);
    expect(e.message).toContain('publish');
  });

  it('LinkedIdentityRevoked carries identity reference', () => {
    const id = makeLinked({ revokedAt: new Date() });
    const e = new LinkedIdentityRevoked(id);
    expect(e.identity).toBe(id);
    expect(e.message).toContain(id.handle);
  });

  // Sanity: typeof Identity narrowing works at runtime
  it('Identity union still includes both kinds', () => {
    const ids: Identity[] = [NATIVE, makeLinked()];
    expect(ids.map(i => i.kind).sort()).toEqual(['linked', 'native']);
  });
});

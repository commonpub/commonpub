/**
 * §P2 (session 241 audit-adjacent): exchangeCodeForToken must reject a
 * remote-supplied actorUri whose host differs from the authenticating instance's
 * domain. Otherwise a compromised trusted instance could return a victim's actorUri
 * on ANOTHER host and the callback (findUserByFederatedAccount, host-unbound) would
 * mint a session as the victim.
 */
import { vi, describe, it, expect } from 'vitest';

let tokenBody: unknown = {};
vi.mock('@commonpub/protocol', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@commonpub/protocol')>();
  return {
    ...actual,
    safeFetchResponse: vi.fn(async () => ({ ok: true, status: 200, body: Buffer.from(JSON.stringify(tokenBody)), headers: {} })),
  };
});

import { exchangeCodeForToken } from '../federation/oauth.js';

const state = {
  tokenEndpoint: 'https://good.example.com/oauth/token',
  clientId: 'cid', clientSecret: 'secret',
  redirectUri: 'https://local.example.com/callback',
  instanceDomain: 'good.example.com',
} as Parameters<typeof exchangeCodeForToken>[0];

describe('exchangeCodeForToken actor-host binding', () => {
  it('accepts an actorUri on the authenticating instance domain', async () => {
    tokenBody = { access_token: 'tok', user: { id: 'u1', username: 'alice', actorUri: 'https://good.example.com/users/alice' } };
    const r = await exchangeCodeForToken(state, 'code');
    expect(r?.user.actorUri).toBe('https://good.example.com/users/alice');
  });

  it('REJECTS (null) an actorUri on a different host (cross-instance takeover attempt)', async () => {
    tokenBody = { access_token: 'tok', user: { id: 'u2', username: 'victim', actorUri: 'https://victim.example.com/users/victim' } };
    const r = await exchangeCodeForToken(state, 'code');
    expect(r).toBeNull();
  });

  it('accepts the synthesized fallback actorUri when the remote omits one', async () => {
    tokenBody = { access_token: 'tok', user: { id: 'u3', username: 'bob' } };
    const r = await exchangeCodeForToken(state, 'code');
    expect(r?.user.actorUri).toBe('https://good.example.com/users/bob');
  });
});

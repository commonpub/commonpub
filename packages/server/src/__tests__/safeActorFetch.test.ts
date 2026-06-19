/**
 * The inbox (layers/base/server/utils/inbox.ts) resolves the attacker-controlled keyId
 * actor with `createSafeActorFetchFn()` (audit session 204 P0 fix) instead of raw fetch.
 * This proves the wrapper preserves the SSRF block, so a keyId pointing at a private/
 * loopback/metadata address cannot drive a server-side request there. (The underlying
 * safeFetchResponse pinned-dispatcher behavior is exhaustively tested in
 * @commonpub/protocol's ssrf suites; this guards the server wrapper used by the inbox.)
 */
import { describe, it, expect } from 'vitest';
import { createSafeActorFetchFn } from '../federation/safeFetchFn.js';

describe('createSafeActorFetchFn — SSRF block preserved (inbox actor resolution)', () => {
  const fetchFn = createSafeActorFetchFn();

  it.each([
    'http://127.0.0.1/actor',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/actor',
    'http://[::1]/actor',
    'http://localhost/actor',
  ])('rejects a request to a private/loopback/metadata target: %s', async (url) => {
    await expect(fetchFn(url)).rejects.toBeTruthy();
  });
});

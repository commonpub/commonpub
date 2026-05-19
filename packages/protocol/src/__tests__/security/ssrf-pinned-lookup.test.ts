/**
 * Regression guard for the SSRF pinned-lookup dispatcher contract.
 *
 * undici's custom `connect.lookup` is invoked with `all` semantics and
 * expects `callback(err, LookupAddress[])` — an ARRAY. Session 148
 * shipped it returning the classic single `(err, address, family)`
 * form; undici then read `addresses[0].address` off a string →
 * `ERR_INVALID_IP_ADDRESS: undefined` and EVERY safeFetch failed
 * ("fetch failed") in production (content import / remote-image
 * fetch). These tests lock the array contract + fail-closed behaviour
 * with zero network (IP-literal inputs make dns.lookup synchronous and
 * offline-deterministic).
 */
import { describe, it, expect } from 'vitest';
import { pinnedLookup } from '../../ssrf';

function lookup(host: string): Promise<{ err: NodeJS.ErrnoException | null; addrs: unknown }> {
  return new Promise((resolve) => {
    pinnedLookup(host, {}, (err, addrs) => resolve({ err, addrs }));
  });
}

describe('pinnedLookup undici contract', () => {
  it('returns the ARRAY form for a public address (not the single string form)', async () => {
    const { err, addrs } = await lookup('93.184.216.34'); // public IPv4 literal
    expect(err).toBeNull();
    expect(Array.isArray(addrs)).toBe(true); // <- the regression: must be an array
    const list = addrs as Array<{ address: string; family: number }>;
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.address).toBe('93.184.216.34');
    expect(typeof list[0]!.family).toBe('number');
  });

  it('fails closed (err + []) for a loopback address', async () => {
    const { err, addrs } = await lookup('127.0.0.1');
    expect(err).toBeTruthy();
    expect(err!.code).toBe('ECONNREFUSED');
    expect(addrs).toEqual([]);
  });

  it('fails closed for an RFC1918 address', async () => {
    const { err } = await lookup('10.1.2.3');
    expect(err).toBeTruthy();
  });

  it('fails closed for the cloud metadata address', async () => {
    const { err } = await lookup('169.254.169.254');
    expect(err).toBeTruthy();
  });
});

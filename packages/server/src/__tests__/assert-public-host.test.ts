/**
 * Unit tests for the DNS-rebind SSRF guard (`assertPublicHost`) and the
 * underlying `isPrivateIp` classifier it relies on.
 *
 * Hermetic: node:dns is mocked so no real resolution happens. Mutation
 * evidence: reverting the private-address rejection in `assertPublicHost`
 * (or the `isPrivateIp` checks) flips the "rejects private" assertions to
 * red — see the comments on each block.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LookupAddress } from 'node:dns';

// Mock node:dns BEFORE importing the module under test so the static import
// of `dns.promises.lookup` resolves to our spy. `vi.hoisted` keeps the spy
// available to the hoisted `vi.mock` factory.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns', () => ({
  default: { promises: { lookup: lookupMock } },
  promises: { lookup: lookupMock },
}));

import { assertPublicHost, PrivateHostError } from '../federation/assertPublicHost.js';
import { isPrivateIp } from '@commonpub/protocol';

function resolvesTo(...addresses: LookupAddress[]): void {
  lookupMock.mockResolvedValue(addresses);
}

describe('isPrivateIp — classifier the guard rests on', () => {
  it('rejects every private/loopback/link-local/metadata range', () => {
    const privateAddrs = [
      '127.0.0.1', // loopback /8
      '10.0.0.1', // private /8
      '172.16.0.1', // private /12
      '172.31.255.254', // private /12 upper edge
      '192.168.1.1', // private /16
      '169.254.169.254', // cloud metadata / link-local
      '::1', // IPv6 loopback
      'fc00::1', // IPv6 unique-local /7
      'fd12:3456::1', // IPv6 unique-local /7
      'fe80::1', // IPv6 link-local /10
    ];
    for (const ip of privateAddrs) {
      expect(isPrivateIp(ip), `${ip} should be private`).toBe(true);
    }
  });

  it('accepts a public IP', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('assertPublicHost — DNS-rebind guard (hermetic, node:dns mocked)', () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  // MUTATION: delete the `isPrivateIp(a.address)` rejection loop in
  // assertPublicHost.ts and these three reject-cases go green → red signal.
  it('rejects a host that resolves to the cloud-metadata address', async () => {
    resolvesTo({ address: '169.254.169.254', family: 4 });
    await expect(assertPublicHost('evil.example.com')).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('rejects a host that resolves to a loopback address', async () => {
    resolvesTo({ address: '127.0.0.1', family: 4 });
    await expect(assertPublicHost('rebind.example.com')).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('rejects when ANY of several resolved addresses is private (fail-closed)', async () => {
    resolvesTo(
      { address: '93.184.216.34', family: 4 }, // public
      { address: '10.1.2.3', family: 4 }, // private — must trip the guard
    );
    await expect(assertPublicHost('mixed.example.com')).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('rejects an IPv6 unique-local resolution', async () => {
    resolvesTo({ address: 'fd00::1', family: 6 });
    await expect(assertPublicHost('v6.example.com')).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('accepts a host that resolves only to public addresses', async () => {
    resolvesTo(
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    );
    await expect(assertPublicHost('mastodon.social')).resolves.toBeUndefined();
  });

  it('fails closed when the host does not resolve', async () => {
    lookupMock.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    await expect(assertPublicHost('does-not-exist.example')).rejects.toBeInstanceOf(PrivateHostError);
  });

  it('fails closed on an empty resolution result', async () => {
    resolvesTo();
    await expect(assertPublicHost('empty.example')).rejects.toBeInstanceOf(PrivateHostError);
  });
});

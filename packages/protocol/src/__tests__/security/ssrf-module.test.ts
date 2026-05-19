/**
 * Unit coverage for the consolidated SSRF module (federation-hardening
 * Item 5). The behavioural end-to-end SSRF tests live in
 * `./ssrf.test.ts` (via resolveActor). This file pins the pure
 * classifier functions directly — including the new 6to4 / NAT64 v6
 * cases added with the pinned-lookup dispatcher (Item 1) — and asserts
 * the public API is exported from the package index so the
 * `@commonpub/server` re-export shim stays intact.
 */
import { describe, it, expect } from 'vitest';
import { isPrivateIp, isPrivateUrl, safeFetch, safeFetchBinary } from '../../ssrf';
import * as protocolIndex from '../../index';

describe('isPrivateIp', () => {
  it('classifies IPv4 private/reserved ranges', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.0.1', '0.0.0.0', '100.64.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it('normalizes dotted IPv4-mapped IPv6 then classifies', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    // NOTE: the compressed-hex mapped form (`::ffff:7f00:1`) is NOT
    // caught by isPrivateIp alone — it is caught at the isPrivateUrl
    // layer by the `/^::ffff:/i` host-string pattern (asserted below).
    // This belt-and-suspenders split is intentional + pre-existing.
  });

  it('blocks IPv6 loopback / ULA / link-local / multicast', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it('blocks 6to4 (2002::/16) and NAT64 (64:ff9b::/96) — new in Item 1', () => {
    expect(isPrivateIp('2002:7f00:1::1')).toBe(true); // 6to4 embedding 127.0.0.1
    expect(isPrivateIp('64:ff9b::7f00:1')).toBe(true); // NAT64 well-known prefix
  });

  it('allows global IPv6', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('isPrivateUrl', () => {
  it('blocks malformed, non-http(s), blocked hostnames, numeric encodings', () => {
    expect(isPrivateUrl('not a url')).toBe(true);
    expect(isPrivateUrl('ftp://example.com')).toBe(true);
    expect(isPrivateUrl('file:///etc/passwd')).toBe(true);
    expect(isPrivateUrl('http://localhost/x')).toBe(true);
    expect(isPrivateUrl('http://metadata.google.internal/')).toBe(true);
    expect(isPrivateUrl('http://2130706433/')).toBe(true); // dotless decimal 127.0.0.1
    expect(isPrivateUrl('http://0x7f000001/')).toBe(true); // hex
    expect(isPrivateUrl('http://0177.0.0.1/')).toBe(true); // octal-leading
  });

  it('blocks literal private IPs incl. IPv4-mapped IPv6 in brackets', () => {
    expect(isPrivateUrl('http://127.0.0.1:3000/x')).toBe(true);
    expect(isPrivateUrl('http://[::1]/x')).toBe(true);
    expect(isPrivateUrl('http://[::ffff:7f00:1]/x')).toBe(true);
  });

  it('allows public hosts', () => {
    expect(isPrivateUrl('https://example.com/path')).toBe(false);
    expect(isPrivateUrl('https://commonpub.io/')).toBe(false);
  });
});

describe('package exports (re-export shim contract)', () => {
  it('exposes the SSRF public API from @commonpub/protocol index', () => {
    expect(typeof protocolIndex.isPrivateUrl).toBe('function');
    expect(typeof protocolIndex.isPrivateIp).toBe('function');
    expect(typeof protocolIndex.safeFetch).toBe('function');
    expect(typeof protocolIndex.safeFetchBinary).toBe('function');
    // module-level identity (same fns the server shim re-exports)
    expect(protocolIndex.isPrivateUrl).toBe(isPrivateUrl);
    expect(protocolIndex.safeFetch).toBe(safeFetch);
    expect(protocolIndex.safeFetchBinary).toBe(safeFetchBinary);
  });
});

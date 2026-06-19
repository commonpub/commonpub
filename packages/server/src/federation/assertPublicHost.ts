/**
 * DNS-rebind SSRF guard for user-supplied Mastodon hosts.
 *
 * megalodon constructs its own axios instance and does NOT route through
 * the SSRF-pinned undici dispatcher in `@commonpub/protocol`'s `safeFetch`.
 * `isValidHost` (mastodonLogin.ts) already rejects IP *literals* and the
 * obvious string-encoding bypasses via `isPrivateUrl` (session 204), but a
 * public *hostname* whose A/AAAA record resolves to a private/loopback/
 * link-local/metadata address would still drive megalodon's axios at an
 * internal target.
 *
 * `assertPublicHost` closes that residual: before we hand a user-supplied
 * host to `generator(...)`/`detector(...)`, we resolve it ourselves (all
 * addresses) and reject if ANY resolved address is private/reserved per the
 * canonical `isPrivateIp` classifier (covers 169.254.169.254 metadata,
 * 127/8, 10/8, 172.16/12, 192.168/16, ::1, fc00::/7, fe80::/10, etc.).
 *
 * TOCTOU residual: this is a check-then-connect. The resolver can return a
 * public address here and a private one when megalodon's axios connects a
 * moment later (DNS rebinding). A complete fix requires pinning megalodon
 * onto a custom axios transport that resolves once and connects to the
 * validated address (mirroring protocol's `pinnedLookup` dispatcher) — that
 * is out of scope for this change and tracked separately. This guard
 * collapses the trivial single-resolution attack and is defence-in-depth.
 */
import dns from 'node:dns';
import { isPrivateIp } from '@commonpub/protocol';

/** Thrown when a user-supplied host resolves to a private/reserved address. */
export class PrivateHostError extends Error {
  constructor(host: string) {
    super(`Host resolves to a private or reserved address: ${host}`);
    this.name = 'PrivateHostError';
  }
}

/**
 * Resolve `host` (all A/AAAA records) and throw `PrivateHostError` if ANY
 * resolved address is private/reserved. Fail-closed: a resolution failure
 * also throws (we will not contact a host we cannot vet).
 *
 * Call this immediately before constructing a megalodon client for a host
 * that originated from user input.
 */
export async function assertPublicHost(host: string): Promise<void> {
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    // Unresolvable / lookup error — treat as unsafe rather than letting
    // megalodon attempt its own resolution unguarded.
    throw new PrivateHostError(host);
  }
  if (addresses.length === 0) {
    throw new PrivateHostError(host);
  }
  for (const a of addresses) {
    if (isPrivateIp(a.address)) {
      throw new PrivateHostError(host);
    }
  }
}

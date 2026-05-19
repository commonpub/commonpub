/**
 * SSRF protection for server-side fetches (content import, remote-asset
 * fetches, federation actor/collection fetches).
 *
 * Canonical home (session 148, federation-hardening Item 5). `@commonpub/
 * server` re-exports `isPrivateUrl`/`safeFetch`/`safeFetchBinary`/
 * `SafeFetchOptions` from here so its public API (stable since 2.48.0)
 * is unchanged for external consumers; `actorResolver.ts` imports
 * `isPrivateUrl` from here so the previously-diverged copy is gone.
 *
 * Two layers of defence:
 *  1. `isPrivateUrl` — synchronous string/literal-IP check (no DNS).
 *  2. A pinned-lookup undici dispatcher — resolves the hostname once,
 *     rejects if ANY resolved address is private/reserved, and connects
 *     to the validated address. This closes the DNS-rebinding TOCTOU
 *     that the string check alone cannot (a public name whose A/AAAA
 *     record points at a private IP).
 */

import net from 'node:net';
import dns from 'node:dns';
import { Agent } from 'undici';

// Tested against the raw hostname string (a strict superset of the
// pre-existing patterns — preserves blocking of names like `127.0.0.1.x`).
const PRIVATE_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^22[4-9]\./, // 224.0.0.0+ multicast / reserved
  /^23\d\./,
  /^24\d\./,
  /^25[0-5]\./,
  /^::1$/,
  /^::$/,
  /^::ffff:/i, // IPv4-mapped IPv6
  /^fc/i, // IPv6 unique-local
  /^fd/i,
  /^fe80/i, // IPv6 link-local
  /^ff/i, // IPv6 multicast
];

const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^22[4-9]\./,
  /^23\d\./,
  /^24\d\./,
  /^25[0-5]\./,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal',
]);

/** Classify a literal IP (v4, v6, or IPv4-mapped IPv6) as private/reserved. */
export function isPrivateIp(ip: string): boolean {
  let addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const mapped = addr.match(/^(?:::ffff:|::)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) addr = mapped[1]!;

  const fam = net.isIP(addr);
  if (fam === 4) return PRIVATE_IPV4_PATTERNS.some((p) => p.test(addr));
  if (fam === 6) {
    if (addr === '::1' || addr === '::') return true;
    if (/^f[cd]/.test(addr)) return true; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
    if (/^ff/.test(addr)) return true; // ff00::/8 multicast
    if (/^2002:/.test(addr)) return true; // 2002::/16 6to4 (can embed a private v4)
    if (/^64:ff9b:/.test(addr)) return true; // 64:ff9b::/96 NAT64 well-known prefix
    return false;
  }
  return false;
}

/**
 * Reject numeric-host SSRF encodings that `new URL()` accepts but no
 * legitimate public host uses: dotless decimal (2130706433), dotless/segmented
 * hex (0x7f000001 / 0x7f.0.0.1), or octal-leading segments (0177.0.0.1).
 */
function isSuspiciousNumericHost(host: string): boolean {
  if (/^\d+$/.test(host)) return true;
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (/^0\d+(\.\d+){0,3}$/.test(host)) return true;
  if (/^0x[0-9a-f]+(\.[0-9a-fx]+){0,3}$/i.test(host)) return true;
  return false;
}

/**
 * Synchronous, string-level SSRF check. Blocks malformed URLs, non-HTTP(S)
 * schemes, blocked hostnames, literal private/reserved IPs (v4, v6,
 * IPv4-mapped), and numeric-encoding bypasses.
 *
 * This does not resolve DNS — a public hostname whose A/AAAA record points
 * at a private address (DNS-rebinding) is NOT caught here. That gap is
 * closed by the pinned-lookup dispatcher used by `safeFetch`/
 * `safeFetchBinary` (which validate every resolved address and connect to
 * the validated IP). Callers that fetch with their own client (e.g.
 * `resolveActor`'s injected `fetchFn`) still get this per-hop string check.
 */
export function isPrivateUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return true;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (isSuspiciousNumericHost(hostname)) return true;
  // String-prefix check (superset of the original behavior — also blocks
  // names crafted as `127.0.0.1.evil.com`).
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(hostname))) return true;
  // Literal-IP check catches normalized forms the string regex misses
  // (e.g. IPv4-mapped IPv6 `::ffff:7f00:1`).
  if (net.isIP(hostname) && isPrivateIp(hostname)) return true;

  return false;
}

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

/**
 * Custom DNS lookup for the SSRF dispatcher. We resolve the hostname
 * ourselves (`all`, `verbatim`), reject if ANY returned address is
 * private/reserved (fail-closed — a rebinding resolver can return a
 * mix), then hand the validated address LIST back.
 *
 * undici's connector invokes the custom `lookup` with `all` semantics
 * and expects `callback(err, LookupAddress[])` (an array of
 * `{ address, family }`) — NOT the classic `(err, address, family)`
 * single form. Returning the single form makes undici read
 * `addresses[0].address` off a string → `ERR_INVALID_IP_ADDRESS:
 * undefined` and every fetch fails. Verified empirically against
 * undici 7 (see ssrf.integration.test.ts). Because every returned
 * address is pre-validated and the connection pins to one of them,
 * there is no second resolution between check and connect (TOCTOU
 * closed).
 */
export function pinnedLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void,
): void {
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      callback(err, []);
      return;
    }
    const list = Array.isArray(addresses) ? addresses : [];
    if (list.length === 0) {
      callback(
        Object.assign(new Error(`SSRF: ${hostname} did not resolve`), { code: 'ENOTFOUND' }),
        [],
      );
      return;
    }
    for (const a of list) {
      if (isPrivateIp(a.address)) {
        callback(
          Object.assign(
            new Error(`SSRF: ${hostname} resolved to a private or reserved address`),
            { code: 'ECONNREFUSED' },
          ),
          [],
        );
        return;
      }
    }
    callback(null, list);
  });
}

/**
 * Module-level dispatcher. One instance is reused across all safe
 * fetches; the pinned lookup runs per-connection so caching is safe.
 */
const ssrfAgent = new Agent({ connect: { lookup: pinnedLookup } });

export interface SafeFetchOptions {
  accept?: string;
  userAgent?: string;
  timeoutMs?: number;
  /** Externally-owned abort signal; when set, the helper does not create its own timeout. */
  signal?: AbortSignal;
  /** HTTP method (default GET). For signed AP requests. */
  method?: string;
  /** Extra request headers, merged over the defaults (User-Agent/Accept). */
  headers?: Record<string, string>;
  /** Request body (signed AP POST). */
  body?: string | Uint8Array;
  /**
   * Follow 3xx redirects (default true). Signed requests MUST pass
   * `false` — replaying a signed body/headers to a redirect target is
   * both invalid (the signature covers the original target) and a
   * confused-deputy risk.
   */
  followRedirects?: boolean;
}

/**
 * Stream a Response body into a Buffer, aborting if it exceeds maxSize.
 * Avoids the "buffer everything, then check" pattern that allows a
 * malicious upstream with chunked encoding (no Content-Length) to OOM us.
 */
async function streamBoundedBody(response: Response, maxSize: number): Promise<Buffer> {
  if (!response.body) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > maxSize) throw new Error('Response too large');
    return buf;
  }
  const reader = response.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxSize) {
        await reader.cancel();
        throw new Error('Response too large');
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* may already be released */ }
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a URL through the pinned-lookup dispatcher, re-validating every
 * hop against `isPrivateUrl`. The caller owns the deadline via
 * `options.signal`, so the abort timeout spans connect + redirects +
 * body read.
 */
async function fetchWithRedirectValidation(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ response: Response; finalUrl: string }> {
  const accept = options.accept ?? 'text/html,application/xhtml+xml';
  const userAgent = options.userAgent ?? 'CommonPub/1.0 (+https://commonpub.io)';
  const signal = options.signal;
  const followRedirects = options.followRedirects ?? true;
  const method = options.method ?? 'GET';

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < MAX_REDIRECTS) {
    if (isPrivateUrl(currentUrl)) {
      throw new Error('URL points to a private or reserved address');
    }

    const response = await fetch(currentUrl, {
      method,
      signal,
      redirect: 'manual',
      headers: { 'User-Agent': userAgent, 'Accept': accept, ...(options.headers ?? {}) },
      ...(options.body !== undefined ? { body: options.body } : {}),
      // Node's built-in fetch (undici) honours `dispatcher`; the WHATWG
      // RequestInit type doesn't declare it, hence the localized cast.
      dispatcher: ssrfAgent,
    } as RequestInit & { dispatcher: Agent });

    if (response.status >= 300 && response.status < 400) {
      if (!followRedirects) {
        return { response, finalUrl: currentUrl };
      }
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without Location header');
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('Too many redirects');
}

/** Run an operation under a single abort deadline that spans fetch + body read. */
async function withDeadline<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch a URL with SSRF protection (string check + pinned-lookup
 * dispatcher), redirect re-validation, a streaming size cap, and a
 * deadline covering the whole exchange. Returns the body as a string.
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ html: string; finalUrl: string }> {
  return withDeadline(options.timeoutMs ?? FETCH_TIMEOUT_MS, async (signal) => {
    const { response, finalUrl } = await fetchWithRedirectValidation(url, { ...options, signal });
    const buffer = await streamBoundedBody(response, MAX_RESPONSE_SIZE);
    return { html: new TextDecoder().decode(buffer), finalUrl };
  });
}

/**
 * Like `safeFetch` but returns the body as a Buffer plus the upstream
 * Content-Type. Use for binary content (images, etc.).
 */
export async function safeFetchBinary(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  return withDeadline(options.timeoutMs ?? FETCH_TIMEOUT_MS, async (signal) => {
    const { response, finalUrl } = await fetchWithRedirectValidation(url, { ...options, signal });
    const contentType = response.headers.get('content-type') ?? '';
    const buffer = await streamBoundedBody(response, MAX_RESPONSE_SIZE);
    return { buffer, contentType, finalUrl };
  });
}

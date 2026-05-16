/** SSRF protection for content import / remote-asset fetches. */

import net from 'node:net';

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
 * NOTE: this does not resolve DNS, so a public hostname whose A/AAAA record
 * points at a private address (DNS-rebinding) is NOT caught here. Redirect
 * targets are re-validated by `fetchWithRedirectValidation`. Closing the
 * DNS-rebinding gap requires connection-pinned resolution (undici dispatcher
 * with a fixed lookup) — tracked as a follow-up.
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

export interface SafeFetchOptions {
  accept?: string;
  userAgent?: string;
  timeoutMs?: number;
  /** Externally-owned abort signal; when set, the helper does not create its own timeout. */
  signal?: AbortSignal;
}

/**
 * Stream a Response body into a Buffer, aborting if it exceeds maxSize.
 * Avoids the "buffer everything, then check" pattern that allows a
 * malicious upstream with chunked encoding (no Content-Length) to OOM us.
 *
 * Falls back to `arrayBuffer()` when `response.body` is unavailable
 * (test mocks, HEAD responses, 304s) — the size check still applies after
 * the buffer is materialised.
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
 * Fetch a URL, re-validating every hop against `isPrivateUrl`.
 *
 * The caller owns the deadline via `options.signal`, so the abort timeout
 * spans connect + redirects + body read (the body is consumed by the caller
 * after this returns) — a slow-trickle upstream that streams headers fast
 * but withholds the body can no longer hold the worker past the timeout.
 */
async function fetchWithRedirectValidation(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ response: Response; finalUrl: string }> {
  const accept = options.accept ?? 'text/html,application/xhtml+xml';
  const userAgent = options.userAgent ?? 'CommonPub/1.0 (+https://commonpub.io)';
  const signal = options.signal;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < MAX_REDIRECTS) {
    if (isPrivateUrl(currentUrl)) {
      throw new Error('URL points to a private or reserved address');
    }

    const response = await fetch(currentUrl, {
      signal,
      redirect: 'manual',
      headers: { 'User-Agent': userAgent, 'Accept': accept },
    });

    if (response.status >= 300 && response.status < 400) {
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
 * Fetch a URL with SSRF protection, redirect re-validation, a streaming
 * size cap, and a deadline covering the whole exchange (incl. body read).
 * Returns the response body as a string.
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

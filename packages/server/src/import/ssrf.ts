/** SSRF protection for content import fetches */

const PRIVATE_IP_PATTERNS = [
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
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80/i,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.internal',
]);

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
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) return true;
  }

  return false;
}

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

export interface SafeFetchOptions {
  accept?: string;
  userAgent?: string;
  timeoutMs?: number;
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
 * Fetch a URL with redirect re-validation against `isPrivateUrl`.
 * Returns the final Response and the final URL (after redirects).
 *
 * Each redirect target is re-validated — Node's `redirect: 'follow'`
 * does not re-check the new host against our blocklist, which would
 * allow an attacker to host `evil.com` redirecting to a private IP.
 */
async function fetchWithRedirectValidation(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ response: Response; finalUrl: string }> {
  if (isPrivateUrl(url)) {
    throw new Error('URL points to a private or reserved address');
  }

  const accept = options.accept ?? 'text/html,application/xhtml+xml';
  const userAgent = options.userAgent ?? 'CommonPub/1.0 (+https://commonpub.io)';
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < MAX_REDIRECTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': userAgent,
          'Accept': accept,
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without Location header');

      const redirectUrl = new URL(location, currentUrl).toString();
      if (isPrivateUrl(redirectUrl)) {
        throw new Error('Redirect points to a private or reserved address');
      }
      currentUrl = redirectUrl;
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

/**
 * Fetch a URL with SSRF protection, redirect validation, size limit, and timeout.
 * Returns the response body as a string.
 */
export async function safeFetch(url: string): Promise<{ html: string; finalUrl: string }> {
  const { response, finalUrl } = await fetchWithRedirectValidation(url);
  const buffer = await streamBoundedBody(response, MAX_RESPONSE_SIZE);
  return { html: new TextDecoder().decode(buffer), finalUrl };
}

/**
 * Fetch a URL with SSRF protection, redirect validation, streaming size cap,
 * and timeout. Returns the response body as a Buffer plus the upstream
 * Content-Type. Use for binary content (images, etc.).
 */
export async function safeFetchBinary(
  url: string,
  options: SafeFetchOptions = {},
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const { response, finalUrl } = await fetchWithRedirectValidation(url, options);
  const contentType = response.headers.get('content-type') ?? '';
  const buffer = await streamBoundedBody(response, MAX_RESPONSE_SIZE);
  return { buffer, contentType, finalUrl };
}

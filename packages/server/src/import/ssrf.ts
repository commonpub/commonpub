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

/**
 * Fetch a URL with SSRF protection, redirect validation, size limit, and timeout.
 * Returns the response body as a string.
 */
export async function safeFetch(url: string): Promise<{ html: string; finalUrl: string }> {
  if (isPrivateUrl(url)) {
    throw new Error('URL points to a private or reserved address');
  }

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < MAX_REDIRECTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'CommonPub/1.0 (+https://commonpub.io)',
          'Accept': 'text/html,application/xhtml+xml',
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

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large');
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large');
    }

    return { html: new TextDecoder().decode(buffer), finalUrl: currentUrl };
  }

  throw new Error('Too many redirects');
}

/**
 * GET /api/image-proxy?url=<remote-url>&w=<width>
 * Proxies and caches remote images for federated content.
 * Prevents slow cross-origin fetches on content cards.
 *
 * Security: enforces HTTPS, blocks private/reserved hosts on the input
 * URL AND on every redirect target (via safeFetchBinary), streams the
 * response body with a hard size cap so a chunked-encoding upstream
 * can't OOM us by withholding Content-Length.
 */
import { safeFetchBinary } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url as string | undefined;
  // `w` query param is reserved for future image-resize work; not currently
  // used for proxying — the upstream image is returned as-is.

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' });
  }

  // Parse and validate the URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' });
  }

  // Only allow HTTPS image URLs (defense-in-depth on top of safeFetchBinary's
  // own private-URL check; safeFetchBinary allows http for content-import use,
  // but image-proxy is HTTPS-only).
  if (parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Only HTTPS URLs allowed' });
  }

  try {
    const { buffer, contentType } = await safeFetchBinary(url, {
      accept: 'image/*',
      userAgent: 'CommonPub/1.0 (image-proxy)',
      timeoutMs: 15_000,
    });

    if (!contentType.startsWith('image/')) {
      throw createError({ statusCode: 502, statusMessage: 'Not an image' });
    }

    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Image-Proxy': 'commonpub',
    });

    return buffer;
  } catch (err: unknown) {
    if ((err as { statusCode?: number })?.statusCode) throw err;
    const msg = err instanceof Error ? err.message : 'Failed to fetch image';
    // Map known private-URL/redirect rejections to 403 so callers can distinguish
    // them from upstream failures.
    if (msg.includes('private or reserved') || msg.includes('Too many redirects')) {
      throw createError({ statusCode: 403, statusMessage: msg });
    }
    if (msg === 'Response too large') {
      throw createError({ statusCode: 502, statusMessage: 'Image too large' });
    }
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch image' });
  }
});

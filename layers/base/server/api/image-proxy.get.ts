/**
 * GET /api/image-proxy?url=<remote-url>&w=<width>
 * Proxies and caches remote images for federated content.
 * Prevents slow cross-origin fetches on content cards.
 *
 * Security: enforces HTTPS, blocks private/reserved hosts on the input
 * URL AND on every redirect target (via safeFetchBinary), streams the
 * response body with a hard size cap so a chunked-encoding upstream
 * can't OOM us by withholding Content-Length.
 *
 * And it neutralizes SVG. `image/svg+xml` is an IMAGE content type, so a
 * `startsWith('image/')` gate passes it, and an SVG is a document that runs
 * script. Served from our own origin that was same-origin script execution
 * against a logged-in visitor, reachable by anyone with a link: `nosniff` cannot
 * help (the type is honest, there is nothing to sniff) and the page CSP is not
 * applied to an API response.
 *
 * Every response now carries the same sandbox CSP `serveFile.ts` uses for stored
 * files. A sandboxed document gets a unique opaque origin, so the script cannot
 * reach this instance's cookies or DOM. SVG is still SERVED rather than refused,
 * because the only consumers are `<img>` and CSS `background-image` on content
 * cards (utils/imageProxy.ts) — neither executes SVG script — and refusing it
 * would simply break federated covers that happen to be vector.
 *
 * Residual risk, stated plainly: this leans on the CSP surviving the edge. A
 * cache or proxy that strips response headers would reopen the hole.
 */
import { safeFetchBinary } from '@commonpub/server';

/**
 * The neutralizing policy, byte-identical to `SVG_NEUTRALIZE_CSP` in
 * server/utils/serveFile.ts. Applied to EVERY proxied response rather than only
 * to the types known to be scriptable today, so a format a future browser learns
 * to treat as active content is covered without anyone remembering to add it.
 */
const NEUTRALIZE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

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

    // Compare the MIME only, so `image/svg+xml; charset=utf-8` cannot slip past.
    const mime = contentType.split(';')[0]!.trim().toLowerCase();
    if (!mime.startsWith('image/')) {
      throw createError({ statusCode: 502, statusMessage: 'Not an image' });
    }
    setResponseHeaders(event, {
      // The normalized MIME, not the upstream header verbatim: echoing an
      // attacker-controlled string into Content-Type is its own hazard.
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Image-Proxy': 'commonpub',
      // Defence in depth for any raster type a future browser learns to treat as
      // active content. Matches serveFile.ts's policy for stored files.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': NEUTRALIZE_CSP,
      'Content-Disposition': 'inline',
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

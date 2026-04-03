/**
 * GET /api/image-proxy?url=<remote-url>&w=<width>
 * Proxies and caches remote images for federated content.
 * Prevents slow cross-origin fetches on content cards.
 *
 * Security: only proxies images from known federation origins
 * (federated_content.origin_domain or remote_actors.instance_domain).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = query.url as string | undefined;
  const width = Math.min(parseInt(String(query.w || '800'), 10), 1920);

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

  // Only allow HTTPS image URLs
  if (parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Only HTTPS URLs allowed' });
  }

  // Block localhost/private IPs (SSRF prevention)
  const hostname = parsed.hostname.toLowerCase();
  const h = hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (
    h === 'localhost' ||
    h === 'localhost.localdomain' ||
    h === 'metadata.google.internal' ||
    h.endsWith('.local') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^0\./.test(h) ||
    h === '::1' ||
    /^f[cd]/i.test(h) ||
    /^fe80/i.test(h)
  ) {
    throw createError({ statusCode: 403, statusMessage: 'Private addresses not allowed' });
  }

  // Fetch the remote image
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        'User-Agent': 'CommonPub/1.0 (image-proxy)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: `Upstream returned ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw createError({ statusCode: 502, statusMessage: 'Not an image' });
    }

    // Limit to 10MB
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > 10 * 1024 * 1024) {
      throw createError({ statusCode: 502, statusMessage: 'Image too large' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Set aggressive cache headers — federated images rarely change
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'X-Image-Proxy': 'commonpub',
    });

    return buffer;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if ((err as { statusCode?: number })?.statusCode) throw err;
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch image' });
  }
});

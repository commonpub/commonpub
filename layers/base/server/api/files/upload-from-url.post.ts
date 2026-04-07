import { z } from 'zod';
import { createStorageFromEnv, generateStorageKey, validateUpload, ALLOWED_IMAGE_TYPES } from '@commonpub/server';

const schema = z.object({
  url: z.string().url(),
  purpose: z.enum(['content', 'cover', 'avatar', 'banner']).default('content'),
});

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const { url, purpose } = await parseBody(event, schema);

  // SSRF protection — block private/internal IPs
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const h = hostname.replace(/^\[|\]$/g, '');
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
    throw createError({ statusCode: 400, statusMessage: 'Cannot fetch from private/local addresses' });
  }

  // Download the remote image
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'devEco.io Image Fetcher' },
    });
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: 'Failed to fetch remote image' });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw createError({ statusCode: 400, statusMessage: `Remote server returned ${response.status}` });
  }

  const contentType = response.headers.get('content-type') || '';
  if (![...ALLOWED_IMAGE_TYPES].some((t: string) => contentType.startsWith(t))) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported image type: ${contentType}` });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (buffer.length > maxSize) {
    throw createError({ statusCode: 400, statusMessage: 'Image too large (max 10MB)' });
  }

  // Upload to storage
  const storage = createStorageFromEnv();
  const ext = contentType.split('/')[1] || 'jpg';
  const key = generateStorageKey(purpose, ext);

  const resultUrl = await storage.upload(key, buffer, contentType);

  return { url: resultUrl };
});

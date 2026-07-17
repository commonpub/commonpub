import { z } from 'zod';
import { generateStorageKey, ALLOWED_IMAGE_TYPES, safeFetchBinary } from '@commonpub/server';

const schema = z.object({
  url: z.string().url(),
  purpose: z.enum(['content', 'cover', 'avatar', 'banner']).default('content'),
});

export default defineEventHandler(async (event) => {
  requireAuth(event);
  const { url, purpose } = await parseBody(event, schema);

  // SSRF-safe fetch: blocks private/reserved/numeric hosts and non-HTTP(S)
  // schemes, re-validates every redirect hop, and enforces a 10 MB streaming
  // cap + deadline. Replaces a hand-rolled denylist that missed redirect
  // re-validation, IPv4-mapped IPv6, and numeric-IP encodings.
  let buffer: Buffer;
  let contentType: string;
  try {
    ({ buffer, contentType } = await safeFetchBinary(url, {
      accept: 'image/*',
      userAgent: 'CommonPub/1.0 (image-upload)',
      timeoutMs: 10_000,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('private or reserved')) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot fetch from private/local addresses' });
    }
    if (msg === 'Response too large') {
      throw createError({ statusCode: 400, statusMessage: 'Image too large (max 10MB)' });
    }
    throw createError({ statusCode: 400, statusMessage: 'Failed to fetch remote image' });
  }

  if (![...ALLOWED_IMAGE_TYPES].some((t: string) => contentType.startsWith(t))) {
    throw createError({ statusCode: 400, statusMessage: `Unsupported image type: ${contentType}` });
  }

  // Upload to storage
  const storage = useFileStorage();
  const ext = contentType.split('/')[1] || 'jpg';
  // generateStorageKey(originalName, purpose) — args were reversed, producing keys
  // like `png/<uuid>` with no extension (folder = MIME subtype). Give it a real
  // filename so the purpose folder + extension come out right (cf. upload.post.ts).
  const key = generateStorageKey(`image.${ext}`, purpose);

  const resultUrl = await storage.upload(key, buffer, contentType);

  return { url: resultUrl };
});

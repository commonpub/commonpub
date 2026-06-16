/**
 * Serve locally-stored uploads at /uploads/<key>.
 *
 * When storage is the LocalStorageAdapter (no S3 configured), uploaded files are
 * written to the configured upload dir at RUNTIME. Nitro's build-time
 * `publicAssets` cannot serve runtime-written files, so this route streams them
 * from disk. It resolves the SAME directory the storage adapter writes to
 * (UPLOAD_DIR / NUXT_UPLOAD_DIR / runtimeConfig.uploadDir) and guards against
 * path traversal. Public by design — avatars/banners/content images are viewed
 * by anyone.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { sendStream } from 'h3';

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
};

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'path') ?? '';
  let rel: string;
  try {
    rel = decodeURIComponent(raw);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Bad request' });
  }
  if (!rel || rel.includes('\0')) {
    throw createError({ statusCode: 400, statusMessage: 'Bad request' });
  }

  // Resolve the upload dir exactly like the storage adapter (createStorageFromEnv).
  const config = useRuntimeConfig(event) as { uploadDir?: string };
  const baseDir = resolve(
    process.env.UPLOAD_DIR ?? process.env.NUXT_UPLOAD_DIR ?? config.uploadDir ?? './uploads',
  );
  const filePath = resolve(baseDir, rel);

  // Path-traversal guard: the resolved path must stay inside baseDir.
  if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }
  if (!stats.isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const mime = MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  setResponseHeader(event, 'Content-Type', mime);
  setResponseHeader(event, 'Content-Length', stats.size);
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400, immutable');
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  // SVGs can embed scripts; neutralise them when served inline.
  if (mime === 'image/svg+xml') {
    setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }

  return sendStream(event, createReadStream(filePath));
});

/**
 * Auth-gated serving route for PRIVATE files (P0 — rich contest registration).
 *
 * Private uploads (purpose=`contest`) are stored non-public (S3 `private` ACL /
 * a non-served local dir) and have NO public URL. This is the ONLY way their
 * bytes come back out: the requester must be authenticated AND either own the
 * file or hold `contest.pii`. The bytes are streamed in-process — a shareable
 * public/presigned URL is never minted, so a confidential legal document or
 * signature image can't leak by URL-passing.
 *
 * Serves private files only; public files keep their existing public URL and are
 * 404'd here so this route can't be turned into an open proxy.
 */
import { eq } from 'drizzle-orm';
import { files } from '@commonpub/schema';
import { createStorageFromEnv } from '@commonpub/server';
import { sendStream } from 'h3';

let storage: ReturnType<typeof createStorageFromEnv> | null = null;
function getStorage(): ReturnType<typeof createStorageFromEnv> {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}

/** Strip anything that could break out of a `Content-Disposition` filename. */
function safeFilename(name: string | null): string {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 128);
  return cleaned || 'download';
}

export default defineEventHandler(async (event) => {
  requireFeature('contestPrivateFiles');
  const user = requireAuth(event);
  // Validate the DOMAIN (uuid), not just presence, before the SQL bind.
  const { id } = parseParams(event, { id: 'uuid' });
  const db = useDB();

  const [row] = await db
    .select({
      uploaderId: files.uploaderId,
      storageKey: files.storageKey,
      mimeType: files.mimeType,
      originalName: files.originalName,
      visibility: files.visibility,
    })
    .from(files)
    .where(eq(files.id, id))
    .limit(1);

  if (!row || row.visibility !== 'private') {
    // Unknown id OR a public file — this route serves private files only.
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  // Owner always; otherwise the contest-PII permission (seeded admin + staff).
  // NOTE (P0): `files` are not yet linked to a specific contest, so any
  // contest.pii holder can read any private file. P6 links registration/entry
  // file fields to their contest and tightens this to that contest's organizers.
  const isOwner = row.uploaderId === user.id;
  if (!isOwner && !hasPermission(event, 'contest.pii')) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this file' });
  }

  let obj;
  try {
    obj = await getStorage().getPrivateObject(row.storageKey);
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const mime = row.mimeType || 'application/octet-stream';
  // Only raster images render inline; everything else (PDF/SVG/zip/text)
  // downloads, so nothing executes same-origin.
  const inline = mime.startsWith('image/') && mime !== 'image/svg+xml';
  setResponseHeader(event, 'Content-Type', mime);
  if (obj.contentLength != null) setResponseHeader(event, 'Content-Length', obj.contentLength);
  // Never cached by shared caches — this is per-user authorized content.
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(
    event,
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${safeFilename(row.originalName)}"`,
  );
  if (mime === 'image/svg+xml') {
    setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }

  return sendStream(event, obj.body);
});

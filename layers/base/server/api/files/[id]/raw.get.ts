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
import type { StorageObject } from '@commonpub/server';
import { sendStream } from 'h3';

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

  // Unknown id, a public file, OR a private file the caller may not read all
  // collapse to the SAME 404 — the route reveals nothing beyond what the caller
  // can already access (no 403 existence oracle). Owner always; otherwise the
  // contest-PII permission (seeded admin + staff).
  // NOTE (P0): `files` are not yet linked to a specific contest, so any
  // contest.pii holder can read any private file. P6 links registration/entry
  // file fields to their contest and tightens this to that contest's organizers.
  const authorized = !!row && row.visibility === 'private'
    && (row.uploaderId === user.id || hasPermission(event, 'contest.pii'));
  if (!row || !authorized) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  let obj: StorageObject;
  try {
    obj = await useFileStorage().getPrivateObject(row.storageKey);
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  // Per-user authorized content — never cached by shared caches.
  setStoredFileHeaders(event, {
    mime: row.mimeType,
    filename: row.originalName,
    contentLength: obj.contentLength,
    cache: 'private, no-store',
  });

  return sendStream(event, obj.body);
});

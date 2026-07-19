import { eq, and } from 'drizzle-orm';
import { files } from '@commonpub/schema';
import { contestIdsForPrivateFile } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ deleted: boolean }> => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });

  // Don't let a file that's already been SUBMITTED to a contest be deleted — that
  // would leave a dangling reference in the registration/entry private fields and
  // destroy an organizer's copy of a signed doc/waiver (P6 evidence integrity).
  // Owner + organizer copies stay reachable via the gated /raw route regardless.
  if ((await contestIdsForPrivateFile(db, id)).length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'This file is attached to a contest submission and cannot be deleted.' });
  }

  const result = await db
    .delete(files)
    .where(and(eq(files.id, id), eq(files.uploaderId, user.id)))
    .returning({ id: files.id, storageKey: files.storageKey, visibility: files.visibility });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'File not found or not owned by you' });
  }

  // Delete from storage (best-effort, don't fail the request if storage delete fails).
  // Private files live in a different key space/base dir, so they need deletePrivate —
  // calling the public `delete` would leave the bytes orphaned.
  try {
    const adapter = useFileStorage();
    const { storageKey, visibility } = result[0]!;
    await (visibility === 'private' ? adapter.deletePrivate(storageKey) : adapter.delete(storageKey));
  } catch {
    // Log but don't fail — the DB record is already deleted
    console.warn(`[files] Failed to delete storage key: ${result[0]!.storageKey}`);
  }

  return { deleted: true };
});

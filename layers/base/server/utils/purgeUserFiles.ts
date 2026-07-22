import { files } from '@commonpub/schema';
import { and, eq } from 'drizzle-orm';
import type { DB } from '@commonpub/server';

/**
 * A user's PRIVATE uploaded object-storage keys. Captured BEFORE a user delete so the
 * bytes can be purged AFTER the DB cascade — `files.uploaderId` is `onDelete: cascade`,
 * so the rows vanish but a DB cascade can NEVER reach the S3/Spaces/local bytes. Without
 * this, private contest PII uploads (signed waivers, ID docs) orphan in the private store
 * forever with no DB pointer to locate them — a GDPR Art. 17 erasure-completeness gap.
 *
 * SCOPE — private files ONLY, deliberately. A private file's ONLY read path is the
 * `/api/files/[id]/raw` route, which needs the `files` row; once that row cascades the
 * file is already unreachable, so deleting its bytes breaks nothing. A PUBLIC file is
 * the opposite: its bytes are served at a DIRECT bucket URL that does NOT need the DB
 * row, and that URL may be embedded in OTHER users' content/hubs. Purging public bytes
 * would 404 those live embeds — so public files are intentionally left (their bytes were
 * already orphaning on delete pre-existing, harmlessly). Full public-file erasure would
 * need reference-counting and is out of scope here.
 */
export interface UserFileKey {
  storageKey: string;
}

/** Snapshot the user's PRIVATE files (call BEFORE deleting the user). */
export async function collectUserPrivateFileKeys(db: DB, userId: string): Promise<UserFileKey[]> {
  return db
    .select({ storageKey: files.storageKey })
    .from(files)
    .where(and(eq(files.uploaderId, userId), eq(files.visibility, 'private')));
}

/**
 * Delete the captured PRIVATE bytes via `deletePrivate`. Best-effort per key: a storage
 * failure is logged but never throws, so it can't leave the account half-deleted (the
 * DB delete has already committed). Run AFTER the user delete succeeds.
 */
export async function deleteUserPrivateFileBytes(keys: UserFileKey[]): Promise<void> {
  if (keys.length === 0) return;
  const adapter = useFileStorage();
  for (const k of keys) {
    try {
      await adapter.deletePrivate(k.storageKey);
    } catch {
      console.warn(`[purgeUserFiles] failed to delete private storage key: ${k.storageKey}`);
    }
  }
}

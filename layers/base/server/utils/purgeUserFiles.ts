import { files } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { DB } from '@commonpub/server';

/**
 * A user's uploaded object-storage keys. Captured BEFORE a user delete so the bytes
 * can be purged AFTER the DB cascade succeeds — `files.uploaderId` is `onDelete: cascade`,
 * so the rows vanish but a DB cascade can NEVER reach the S3/Spaces/local bytes. Without
 * this, private contest PII uploads (signed waivers, ID docs) orphan in the private store
 * forever with no DB pointer to locate them — a GDPR Art. 17 erasure-completeness gap.
 */
export interface UserFileKey {
  storageKey: string;
  visibility: string;
}

/** Snapshot every file the user owns (call BEFORE deleting the user). */
export async function collectUserFileKeys(db: DB, userId: string): Promise<UserFileKey[]> {
  return db
    .select({ storageKey: files.storageKey, visibility: files.visibility })
    .from(files)
    .where(eq(files.uploaderId, userId));
}

/**
 * Delete the captured bytes from object storage — private via `deletePrivate` (a
 * different key space/base dir), public via `delete`. Best-effort per key: a storage
 * failure is logged but never throws, so it can't leave the account half-deleted (the
 * DB delete has already committed). Run AFTER the user delete succeeds.
 */
export async function deleteUserFileBytes(keys: UserFileKey[]): Promise<void> {
  if (keys.length === 0) return;
  const adapter = useFileStorage();
  for (const k of keys) {
    try {
      await (k.visibility === 'private' ? adapter.deletePrivate(k.storageKey) : adapter.delete(k.storageKey));
    } catch {
      console.warn(`[purgeUserFiles] failed to delete storage key: ${k.storageKey}`);
    }
  }
}

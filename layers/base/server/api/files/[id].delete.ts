import { eq, and } from 'drizzle-orm';
import { files } from '@commonpub/schema';
import { createStorageFromEnv } from '@commonpub/server';

let storage: ReturnType<typeof createStorageFromEnv> | null = null;
function getStorage(): ReturnType<typeof createStorageFromEnv> {
  if (!storage) storage = createStorageFromEnv();
  return storage;
}

export default defineEventHandler(async (event): Promise<{ deleted: boolean }> => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });

  const result = await db
    .delete(files)
    .where(and(eq(files.id, id), eq(files.uploaderId, user.id)))
    .returning({ id: files.id, storageKey: files.storageKey });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'File not found or not owned by you' });
  }

  // Delete from storage (best-effort, don't fail the request if storage delete fails)
  try {
    const adapter = getStorage();
    await adapter.delete(result[0]!.storageKey);
  } catch {
    // Log but don't fail — the DB record is already deleted
    console.warn(`[files] Failed to delete storage key: ${result[0]!.storageKey}`);
  }

  return { deleted: true };
});

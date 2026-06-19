import { listContentVersions } from '@commonpub/server';
import type { ContentVersionItem } from '@commonpub/server';
import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event): Promise<ContentVersionItem[]> => {
  requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Version history (titles, author, timestamps, incl. for unpublished drafts) is
  // author/moderator-only — was world-readable for any content id (audit session 204).
  const [row] = await db
    .select({ authorId: contentItems.authorId })
    .from(contentItems)
    .where(eq(contentItems.id, id))
    .limit(1);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  if (!ownerOrPermission(event, row.authorId, 'content.moderate')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  return listContentVersions(db, id);
});

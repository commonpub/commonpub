import { eq, desc } from 'drizzle-orm';
import { files } from '@commonpub/schema';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const query = parseQueryParams(event, querySchema);

  const rows = await db
    .select()
    .from(files)
    .where(eq(files.uploaderId, user.id))
    .orderBy(desc(files.createdAt))
    .limit(query.limit ?? 50);

  return rows.map((f) => ({
    id: f.id,
    filename: f.filename,
    originalName: f.originalName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    // Private files have no public URL — hand back the auth-gated serving route
    // (mirrors upload.post.ts) so the owner can still reach their own bytes.
    url: f.visibility === 'private' ? `/api/files/${f.id}/raw` : f.publicUrl,
    visibility: f.visibility,
    purpose: f.purpose,
    createdAt: f.createdAt,
  }));
});

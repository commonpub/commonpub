import { getUserByUsername, getUserContent } from '@commonpub/server';
import type { ContentListItem } from '@commonpub/server';
import { contentTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const userContentQuerySchema = z.object({
  type: contentTypeSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  // `?drafts=true` requests the owner's unpublished work; honoured server-side
  // only when the authenticated viewer IS the profile owner (never trusted as-is).
  drafts: z.enum(['true', 'false']).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: ContentListItem[]; nextCursor: string | null }> => {
  const db = useDB();
  const { username } = parseParams(event, { username: 'string' });
  const query = parseQueryParams(event, userContentQuerySchema);
  const viewer = getOptionalUser(event);

  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return getUserContent(db, user.id, {
    type: query.type,
    cursor: query.cursor,
    limit: query.limit,
    drafts: query.drafts === 'true',
    viewerId: viewer?.id,
  });
});

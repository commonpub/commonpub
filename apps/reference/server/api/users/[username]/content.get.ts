import { getUserByUsername, getUserContent } from '@commonpub/server';
import type { PaginatedResponse, ContentListItem } from '@commonpub/server';
import { contentTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const userContentQuerySchema = z.object({
  type: contentTypeSchema.optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContentListItem>> => {
  const db = useDB();
  const { username } = parseParams(event, { username: 'string' });
  const query = parseQueryParams(event, userContentQuerySchema);

  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return getUserContent(db, user.id, query.type);
});

import { getUserByUsername, listFollowing } from '@commonpub/server';
import type { PaginatedResponse, FollowUserItem } from '@commonpub/server';
import { z } from 'zod';

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<FollowUserItem>> => {
  const db = useDB();
  const username = getRouterParam(event, 'username');
  const query = paginationSchema.parse(getQuery(event));

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'Username is required' });
  }

  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return listFollowing(db, target.id, query);
});

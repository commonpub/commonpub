import { listUsers } from '@commonpub/server';
import type { PaginatedResponse, UserListItem } from '@commonpub/server';
import { z } from 'zod';

const adminUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<UserListItem>> => {
  requireAdmin(event);
  const db = useDB();
  const filters = adminUsersQuerySchema.parse(getQuery(event));

  return listUsers(db, filters);
});

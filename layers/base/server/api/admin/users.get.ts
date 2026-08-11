import { listUsers } from '@commonpub/server';
import type { PaginatedResponse, UserListItem } from '@commonpub/server';
import { z } from 'zod';

const adminUsersQuerySchema = z.object({
  search: z.string().max(200).optional(),
  // NOT z.coerce.boolean(): that maps the string 'false' to TRUE (any non-empty
  // string is truthy), which would silently invert the "unconfirmed only"
  // filter into "everyone". Parse the literal, then map.
  emailVerified: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<UserListItem>> => {
  requireFeature('admin');
  requirePermission(event, 'users.read');
  const db = useDB();
  const filters = parseQueryParams(event, adminUsersQuerySchema);

  return listUsers(db, filters);
});

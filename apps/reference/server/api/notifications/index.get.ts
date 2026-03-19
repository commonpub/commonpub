import { listNotifications } from '@commonpub/server';
import type { PaginatedResponse, NotificationItem } from '@commonpub/server';
import { z } from 'zod';

const notificationsQuerySchema = z.object({
  type: z.string().max(64).optional(),
  read: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<NotificationItem>> => {
  const user = requireAuth(event);
  const db = useDB();
  const query = notificationsQuerySchema.parse(getQuery(event));

  return listNotifications(db, {
    userId: user.id,
    type: query.type,
    read: query.read !== undefined ? query.read === 'true' : undefined,
    limit: query.limit,
    offset: query.offset,
  });
});

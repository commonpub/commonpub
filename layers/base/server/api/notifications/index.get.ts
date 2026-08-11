import { listNotifications, toPageMeta } from '@commonpub/server';
import type { PaginatedPage, NotificationItem, NotificationType } from '@commonpub/server';
import { z } from 'zod';

const notificationsQuerySchema = z.object({
  type: z.string().max(64).optional(),
  read: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedPage<NotificationItem>> => {
  const user = requireAuth(event);
  const db = useDB();
  const query = parseQueryParams(event, notificationsQuerySchema);

  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const result = await listNotifications(db, {
    userId: user.id,
    type: query.type as NotificationType | undefined,
    read: query.read !== undefined ? query.read === 'true' : undefined,
    limit,
    offset,
  });
  return { ...result, ...toPageMeta({ total: result.total, returned: result.items.length, limit, offset }) };
});

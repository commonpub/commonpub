import { markNotificationRead, markAllNotificationsRead } from '@commonpub/server';
import { z } from 'zod';

const markReadSchema = z.object({
  notificationId: z.string().uuid().optional(),
});

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await parseBody(event, markReadSchema);

  if (body.notificationId) {
    await markNotificationRead(db, body.notificationId, user.id);
  } else {
    await markAllNotificationsRead(db, user.id);
  }

  return { success: true };
});

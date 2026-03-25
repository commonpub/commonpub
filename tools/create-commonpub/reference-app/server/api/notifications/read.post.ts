import { markNotificationRead, markAllNotificationsRead } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  if (body.notificationId) {
    await markNotificationRead(db, body.notificationId, user.id);
  } else {
    await markAllNotificationsRead(db, user.id);
  }

  return { success: true };
});

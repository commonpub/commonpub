import { getUnreadCount } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ count: number }> => {
  const user = requireAuth(event);
  const db = useDB();

  const count = await getUnreadCount(db, user.id);

  return { count };
});

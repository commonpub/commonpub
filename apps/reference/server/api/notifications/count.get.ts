import { getUnreadCount } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();

  const count = await getUnreadCount(db, user.id);

  return { count };
});

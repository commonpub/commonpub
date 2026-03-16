import { listNotifications } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = getQuery(event);

  return listNotifications(db, {
    userId: user.id,
    type: query.type as string | undefined,
    read: query.read !== undefined ? query.read === 'true' : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});

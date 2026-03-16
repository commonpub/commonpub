import { deleteNotification } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  await deleteNotification(db, id, user.id);

  return { success: true };
});

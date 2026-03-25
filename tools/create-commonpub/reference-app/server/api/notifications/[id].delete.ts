import { deleteNotification } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  await deleteNotification(db, id, user.id);

  return { success: true };
});

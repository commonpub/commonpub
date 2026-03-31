import { deleteComment } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const deleted = await deleteComment(db, id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Comment not found or not owned by you' });
  }
  return { success: true };
});

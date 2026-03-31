import { deleteContent, onContentDeleted } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { id } = parseParams(event, { id: 'uuid' });

  const deleted = await deleteContent(db, id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found or not owned by you' });
  }

  // Federate the deletion (content row still exists as soft-deleted, slug available)
  await onContentDeleted(db, id, user.username, config);

  return { success: true };
});

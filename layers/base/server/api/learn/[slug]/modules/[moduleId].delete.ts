import { deleteModule } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { moduleId } = parseParams(event, { moduleId: 'uuid' });

  const deleted = await deleteModule(db, moduleId, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found or not authorized' });
  }

  return { success: true };
});

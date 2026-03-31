import { deleteLesson } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { lessonId } = parseParams(event, { lessonId: 'uuid' });

  const deleted = await deleteLesson(db, lessonId, user.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found or not authorized' });
  }

  return { success: true };
});

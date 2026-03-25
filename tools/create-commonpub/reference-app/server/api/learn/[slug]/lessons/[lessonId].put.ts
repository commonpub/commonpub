import { updateLesson } from '@commonpub/server';
import { z } from 'zod';

const updateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(['article', 'video', 'quiz', 'project', 'explainer']).optional(),
  content: z.unknown().optional(),
  contentItemId: z.string().uuid().nullable().optional(),
  durationMinutes: z.number().int().min(0).max(9999).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { lessonId } = parseParams(event, { lessonId: 'uuid' });
  const input = await parseBody(event, updateLessonSchema);

  const result = await updateLesson(db, lessonId, user.id, input);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found or not authorized' });
  }

  return result;
});

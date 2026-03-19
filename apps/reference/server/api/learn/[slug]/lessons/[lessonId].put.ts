import { updateLesson } from '@commonpub/server';
import { z } from 'zod';

const updateLessonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: z.enum(['article', 'video', 'quiz', 'project', 'explainer']).optional(),
  content: z.unknown().optional(),
  durationMinutes: z.number().int().min(0).max(9999).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const lessonId = getRouterParam(event, 'lessonId')!;
  const body = updateLessonSchema.parse(await readBody(event));

  const result = await updateLesson(db, lessonId, user.id, body);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found or not authorized' });
  }

  return result;
});

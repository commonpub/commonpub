import { getLessonBySlug, markLessonComplete } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const lessonSlug = getRouterParam(event, 'lessonSlug')!;
  const body = await readBody(event).catch(() => ({}));

  const lesson = await getLessonBySlug(db, slug, lessonSlug);
  if (!lesson) throw createError({ statusCode: 404, message: 'Lesson not found' });

  return markLessonComplete(db, user.id, lesson.id, body?.quizScore, body?.quizPassed);
});

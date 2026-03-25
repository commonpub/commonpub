import { getLessonBySlug, markLessonComplete } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, lessonSlug } = parseParams(event, { slug: 'string', lessonSlug: 'string' });
  const body = await readBody(event).catch(() => ({}));

  const result = await getLessonBySlug(db, slug, lessonSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Lesson not found' });

  return markLessonComplete(db, user.id, result.lesson.id, body?.quizScore, body?.quizPassed);
});

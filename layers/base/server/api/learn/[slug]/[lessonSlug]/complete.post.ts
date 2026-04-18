import { getLessonBySlug, markLessonComplete } from '@commonpub/server';
import { completeLessonSchema } from '@commonpub/learning';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, lessonSlug } = parseParams(event, { slug: 'string', lessonSlug: 'string' });

  // Validate body. Strip any client-supplied quizScore/quizPassed (the schema
  // is `.strict()` and only whitelists `answers`) — server is the source of
  // truth for whether a quiz passed. Accept empty body for non-quiz lessons.
  const input = await parseBody(event, completeLessonSchema);

  const result = await getLessonBySlug(db, slug, lessonSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Lesson not found' });

  try {
    return await markLessonComplete(db, user.id, result.lesson.id, input.answers);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Quiz lessons require answers')) {
      throw createError({ statusCode: 400, statusMessage: msg });
    }
    if (msg.includes('Not enrolled')) {
      throw createError({ statusCode: 403, statusMessage: msg });
    }
    throw err;
  }
});

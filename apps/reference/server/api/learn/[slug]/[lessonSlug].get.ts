import { getLessonBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const lessonSlug = getRouterParam(event, 'lessonSlug')!;

  const lesson = await getLessonBySlug(db, slug, lessonSlug);
  if (!lesson) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' });
  }
  return lesson;
});

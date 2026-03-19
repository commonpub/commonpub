import { getLessonBySlug } from '@commonpub/server';
import { renderMarkdown } from '@commonpub/docs';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const lessonSlug = getRouterParam(event, 'lessonSlug')!;

  const result = await getLessonBySlug(db, slug, lessonSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' });
  }

  // Render markdown content to HTML server-side
  const content = result.lesson.content as Record<string, unknown> | null;
  let renderedHtml = '';
  if (content) {
    const md = typeof content.markdown === 'string' ? content.markdown
      : typeof content.notes === 'string' ? content.notes
      : '';
    if (md) {
      const rendered = await renderMarkdown(md);
      renderedHtml = rendered.html;
    }
  }

  return { ...result, renderedHtml };
});

import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals }) => {
  const [featuredResult, articles, blogPosts] = await Promise.all([
    listContent(locals.db, { status: 'published', type: 'article', featured: true, limit: 1 }),
    listContent(locals.db, { status: 'published', type: 'article', sort: 'recent', limit: 6 }),
    listContent(locals.db, { status: 'published', type: 'blog', sort: 'recent', limit: 6 }),
  ]);

  return {
    featured: featuredResult.items[0] ?? null,
    articles: articles.items,
    blogPosts: blogPosts.items,
  };
};

import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals }) => {
  const [featured, recentProjects, recentArticles, recentBlog] = await Promise.all([
    listContent(locals.db, { status: 'published', featured: true, limit: 1 }),
    listContent(locals.db, { status: 'published', type: 'project', limit: 6 }),
    listContent(locals.db, { status: 'published', type: 'article', limit: 4 }),
    listContent(locals.db, { status: 'published', type: 'blog', limit: 4 }),
  ]);

  return {
    featured: featured.items[0] ?? null,
    recentProjects: recentProjects.items,
    recentArticles: recentArticles.items,
    recentBlog: recentBlog.items,
  };
};

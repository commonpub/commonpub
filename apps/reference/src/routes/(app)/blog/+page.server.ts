import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals, url }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await listContent(locals.db, {
    status: 'published',
    type: 'blog',
    limit,
    offset,
  });

  return { items, total, page };
};

import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals, url }) => {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1')) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await listContent(locals.db, {
    status: 'published',
    sort: 'recent',
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);
  return { items, total, totalPages, page };
};

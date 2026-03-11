import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals, url }) => {
  const q = url.searchParams.get('q') ?? '';
  const type = url.searchParams.get('type') ?? undefined;
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1')) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  if (!q) {
    return { items: [], total: 0, totalPages: 0, query: '', type: type ?? 'all', page };
  }

  const { items, total } = await listContent(locals.db, {
    status: 'published',
    type,
    search: q,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);
  return { items, total, totalPages, query: q, type: type ?? 'all', page };
};

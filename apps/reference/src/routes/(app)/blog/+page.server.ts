import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals, url }) => {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1')) || 1);
  const sort = (url.searchParams.get('sort') ?? 'recent') as 'recent' | 'popular' | 'featured';
  const limit = 12;
  const offset = (page - 1) * limit;

  const [featured, listing] = await Promise.all([
    page === 1 ? listContent(locals.db, { status: 'published', type: 'blog', featured: true, limit: 1 }) : Promise.resolve({ items: [], total: 0 }),
    listContent(locals.db, { status: 'published', type: 'blog', sort, limit, offset }),
  ]);

  return {
    featured: page === 1 ? featured.items[0] ?? null : null,
    items: listing.items,
    total: listing.total,
    totalPages: Math.ceil(listing.total / limit),
    page,
    sort,
  };
};

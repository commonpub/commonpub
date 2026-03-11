import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals, url }) => {
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? '1')) || 1);
  const sort = (url.searchParams.get('sort') ?? 'recent') as 'recent' | 'popular' | 'featured';
  const difficulty = url.searchParams.get('difficulty') ?? undefined;
  const tag = url.searchParams.get('tag') ?? undefined;
  const limit = 12;
  const offset = (page - 1) * limit;

  const { items, total } = await listContent(locals.db, {
    status: 'published',
    type: 'project',
    sort,
    difficulty,
    tag,
    limit,
    offset,
  });

  const totalPages = Math.ceil(total / limit);

  return { items, total, page, totalPages, sort, difficulty, tag };
};

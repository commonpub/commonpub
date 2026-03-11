import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listContent } from '$lib/server/content';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.config.features.explainers) {
    error(404, 'Explainer system is not enabled');
  }

  const page = Number(url.searchParams.get('page') ?? '1');
  const sort = (url.searchParams.get('sort') ?? 'recent') as 'recent' | 'popular' | 'featured';
  const limit = 12;
  const offset = (page - 1) * limit;

  const { items, total } = await listContent(locals.db, {
    status: 'published',
    type: 'explainer',
    sort,
    limit,
    offset,
  });

  return {
    items,
    total,
    totalPages: Math.ceil(total / limit),
    page,
    sort,
  };
};

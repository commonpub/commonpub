import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getContentBySlug, incrementViewCount } from '$lib/server/content';
import { urlSegmentToType } from '$lib/utils/content-helpers';

export const load: PageServerLoad = async ({ params, locals }) => {
  const contentType = urlSegmentToType(params.type);
  const item = await getContentBySlug(locals.db, params.slug, locals.user?.id);

  if (!item) {
    error(404, 'Content not found');
  }

  if (item.type !== contentType) {
    error(404, 'Content not found');
  }

  // Increment view count (fire-and-forget)
  incrementViewCount(locals.db, item.id).catch(() => {});

  return { item };
};

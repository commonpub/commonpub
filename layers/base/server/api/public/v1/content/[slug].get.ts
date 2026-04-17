import { getContentBySlug, toPublicContentDetail, type PublicContentRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  author: z.string().max(128).optional(),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:content');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' });
  }

  const db = useDB();
  const config = useConfig();

  // Pass undefined requester — getContentBySlug returns null for any row where
  // status !== 'published' and authorId !== requesterId, and it already
  // excludes deleted rows via its own WHERE clause. So the only thing left
  // to guard is visibility: public API only returns public-visibility content.
  const content = await getContentBySlug(db, slug, undefined, parsed.data.author);
  if (!content || content.status !== 'published') {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }
  const visibility = (content as { visibility?: string | null }).visibility;
  if (visibility && visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }

  return toPublicContentDetail(content as unknown as PublicContentRow, config.instance.domain);
});

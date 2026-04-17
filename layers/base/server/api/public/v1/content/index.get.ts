import { listContent, toPublicContentSummary, type PublicContentRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  type: z.enum(['project', 'blog', 'explainer']).optional(),
  tag: z.string().max(80).optional(),
  authorId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['recent', 'popular', 'featured']).default('recent'),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:content');
  const db = useDB();
  const config = useConfig();
  const rawQuery = getQuery(event);
  const parsed = querySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const filters = parsed.data;

  // Hard-forced: only published + public + non-deleted content.
  // These overrides mirror the internal /api/content hardening (session 127)
  // but live here too so a future internal-API change can't accidentally
  // relax the public-surface guarantees.
  const result = await listContent(db, {
    status: 'published',
    visibility: 'public',
    type: filters.type,
    tag: filters.tag,
    authorId: filters.authorId,
    categoryId: filters.categoryId,
    difficulty: filters.difficulty,
    limit: filters.limit,
    offset: filters.offset,
    sort: filters.sort,
  }, {
    includeFederated: config.features.seamlessFederation,
    allowedContentTypes: config.instance.contentTypes,
  });

  // listContent already filters out deletedAt / non-published; the forced
  // status+visibility above belt-and-suspenders that. Serialize via
  // allow-list so any new internal column stays internal.
  const domain = config.instance.domain;
  const items = result.items.map((row) => toPublicContentSummary(row as unknown as PublicContentRow, domain));

  return {
    items,
    total: result.total,
    limit: filters.limit,
    offset: filters.offset,
  };
});

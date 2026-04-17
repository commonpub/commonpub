import { searchContent, toPublicContentSummary, type PublicContentRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['project', 'blog', 'explainer']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:search');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const { q, type, limit, offset } = parsed.data;
  const db = useDB();
  const config = useConfig();
  const result = await searchContent(db, { query: q, type, limit, offset });
  const domain = config.instance.domain;
  const items = (result.items as unknown as PublicContentRow[])
    .filter((r) => r.status === 'published' && !r.deletedAt)
    .map((r) => toPublicContentSummary(r, domain));
  return { items, total: result.total, limit, offset, query: q };
});

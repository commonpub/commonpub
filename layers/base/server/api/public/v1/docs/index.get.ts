import { listDocsSites, toPublicDocSite, isPublicDocSite, type PublicDocSiteRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:docs');
  requireFeature('docs');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const { limit, offset } = parsed.data;
  const db = useDB();
  const config = useConfig();
  const result = await listDocsSites(db, { limit, offset });
  const domain = config.instance.domain;
  const items = (result.items as unknown as PublicDocSiteRow[])
    .filter(isPublicDocSite)
    .map((r) => toPublicDocSite(r, domain));
  return { items, total: result.total, limit, offset };
});

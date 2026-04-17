import { toPublicTag, type PublicTagRow } from '@commonpub/server';
import { tags, contentTags } from '@commonpub/schema';
import { desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:tags');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const { limit, offset } = parsed.data;
  const db = useDB();
  const config = useConfig();

  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      usageCount: sql<number>`count(${contentTags.contentId})::int`,
    })
    .from(tags)
    .leftJoin(contentTags, sql`${contentTags.tagId} = ${tags.id}`)
    .groupBy(tags.id, tags.name, tags.slug)
    .orderBy(desc(sql<number>`count(${contentTags.contentId})`), tags.name)
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(tags);
  const domain = config.instance.domain;
  const items = (rows as unknown as PublicTagRow[]).map((r) => toPublicTag(r, domain));
  return { items, total: total ?? 0, limit, offset };
});

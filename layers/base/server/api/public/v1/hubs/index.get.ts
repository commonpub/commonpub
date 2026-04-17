import { listHubs, toPublicHub, type PublicHubRow } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  type: z.enum(['community', 'product', 'company']).optional(),
  search: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:hubs');
  const db = useDB();
  const config = useConfig();

  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const filters = parsed.data;

  // listHubs doesn't accept hubType as a filter today, so we over-fetch and
  // narrow here. At current hub volume this is fine; if it grows the
  // internal filter signature should be widened.
  const result = await listHubs(db, {
    search: filters.search,
    limit: filters.limit,
    offset: filters.offset,
  });

  const domain = config.instance.domain;
  let items = (result.items as unknown as PublicHubRow[])
    .filter((row) => row.deletedAt === null)
    .map((row) => toPublicHub(row, domain));
  if (filters.type) {
    items = items.filter((h) => h.hubType === filters.type);
  }

  return {
    items,
    total: result.total,
    limit: filters.limit,
    offset: filters.offset,
  };
});

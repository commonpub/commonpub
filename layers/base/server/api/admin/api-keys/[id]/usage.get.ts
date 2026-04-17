import { getApiKeyById, getApiKeyUsageStats } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  windowDays: z.coerce.number().int().min(1).max(90).default(7),
});

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters' });
  }
  const db = useDB();
  const key = await getApiKeyById(db, id);
  if (!key) throw createError({ statusCode: 404, statusMessage: 'Key not found' });
  return getApiKeyUsageStats(db, id, parsed.data.windowDays);
});

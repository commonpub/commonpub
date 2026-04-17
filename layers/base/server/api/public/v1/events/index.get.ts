import { listEvents, toPublicEvent, type PublicEventRow } from '@commonpub/server';
import { z } from 'zod';

const PUBLIC_STATUSES = new Set(['published', 'active', 'completed']);

const querySchema = z.object({
  status: z.string().optional(),
  hubId: z.string().uuid().optional(),
  upcoming: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:events');
  requireFeature('events');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const filters = parsed.data;
  // Non-owner may only request public-safe statuses — anything else coerces to undefined
  // (list function default), matching the /api/events hardening from session 125.
  const status = filters.status && PUBLIC_STATUSES.has(filters.status) ? filters.status : undefined;
  const db = useDB();
  const config = useConfig();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await listEvents(db, {
    status: status as any,
    hubId: filters.hubId,
    upcoming: filters.upcoming,
    featured: filters.featured,
    limit: filters.limit,
    offset: filters.offset,
  });
  const domain = config.instance.domain;
  const items = (result.items as unknown as PublicEventRow[])
    .filter((r) => !r.deletedAt && PUBLIC_STATUSES.has(r.status))
    .map((r) => toPublicEvent(r, domain));
  return { items, total: result.total, limit: filters.limit, offset: filters.offset };
});

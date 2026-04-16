import { updateEvent } from '@commonpub/server';
import { z } from 'zod';

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  coverImage: z.string().max(500).nullable().optional(),
  eventType: z.enum(['in-person', 'online', 'hybrid']).optional(),
  status: z.enum(['draft', 'published', 'active', 'completed', 'cancelled']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(500).optional(),
  locationUrl: z.string().url().max(500).optional(),
  onlineUrl: z.string().url().max(500).optional(),
  capacity: z.number().int().min(1).max(100000).optional(),
  isFeatured: z.boolean().optional(),
});

/**
 * PUT /api/events/:slug
 * Update an event (owner or admin).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const body = await parseBody(event, updateEventSchema);
  const isAdmin = user.role === 'admin';

  const result = await updateEvent(db, slug, user.id, body, isAdmin);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Event not found or unauthorized' });

  return result;
});

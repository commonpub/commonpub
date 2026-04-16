import { createEvent } from '@commonpub/server';
import { generateSlug } from '@commonpub/server';
import { z } from 'zod';

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  coverImage: z.string().max(500).optional(),
  eventType: z.enum(['in-person', 'online', 'hybrid']).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(500).optional(),
  locationUrl: z.string().url().max(500).optional(),
  onlineUrl: z.string().url().max(500).optional(),
  capacity: z.number().int().min(1).max(100000).optional(),
  hubId: z.string().uuid().optional(),
});

/**
 * POST /api/events
 * Create a new event (authenticated).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const user = requireAuth(event);
  const db = useDB();
  const body = await parseBody(event, createEventSchema);

  const slug = generateSlug(body.title);

  return createEvent(db, {
    ...body,
    slug,
    createdBy: user.id,
  });
});

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
}).refine(d => new Date(d.endDate) > new Date(d.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

/**
 * POST /api/events
 * Create a new event (authenticated).
 *
 * RBAC-7 (session 231): deliberately NOT gated with
 * `requirePermission(event, 'event.create')`. Event creation is open to every
 * authenticated user today (requireFeature + requireAuth only), and the
 * `event.create` catalog key is seeded ONLY to `staff`/`admin` — the `member`,
 * `pro`, and `verified` system roles have EMPTY grant sets, and with
 * `features.rbac` OFF (the default) EVERY non-admin resolves to no grants. A bare
 * `requirePermission('event.create')` gate would therefore 403 every normal
 * member (both flag-on and flag-off) — a regression. Governance, if ever wanted,
 * must mirror contests: add a `config.instance.eventCreation` ('open'|'staff'|
 * 'admin', default 'open') policy enforced against `user.role` inside
 * `createEvent`, preserving today's open-creation default. Do not slap a
 * permission gate on this route. (RBAC-7, REGRESSION_RISK verdict.)
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

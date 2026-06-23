import { z } from 'zod';
import { getContestBySlug, searchUsers } from '@commonpub/server';
import type { UserSearchResult } from '@commonpub/server';

const querySchema = z.object({
  q: z.string().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

/**
 * Scoped user lookup for contest invite pickers (judges/reviewers). Returns
 * PUBLIC fields only and is gated to contest managers (owner / contest.manage),
 * so non-admin organizers can search without the admin-only user list (the 403
 * bug the judge/stakeholder managers used to hit).
 */
export default defineEventHandler(async (event): Promise<UserSearchResult[]> => {
  requireFeature('contests');
  requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!ownerOrPermission(event, contest.createdById, 'contest.manage')) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to manage this contest' });
  }

  const { q, limit } = await parseQueryParams(event, querySchema);
  return searchUsers(db, q, limit ?? 10);
});

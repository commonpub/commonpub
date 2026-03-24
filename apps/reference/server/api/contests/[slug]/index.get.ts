import { getContestBySlug } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  return contest;
});

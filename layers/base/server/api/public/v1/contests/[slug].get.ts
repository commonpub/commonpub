import { getContestBySlug, toPublicContest, isPublicContest, type PublicContestRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:contests');
  requireFeature('contests');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });
  const db = useDB();
  const config = useConfig();
  const row = await getContestBySlug(db, slug);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  const casted = row as unknown as PublicContestRow;
  if (!isPublicContest(casted)) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  return toPublicContest(casted, config.instance.domain);
});

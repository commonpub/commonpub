import { updateContest } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';
import { updateContestSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, updateContestSchema);

  let result;
  try {
    result = await updateContest(db, slug, user.id, input);
  } catch (err) {
    if (err instanceof Error && err.message === 'SLUG_TAKEN') {
      throw createError({ statusCode: 409, statusMessage: 'That URL slug is already in use by another contest.' });
    }
    throw err;
  }
  if (!result) throw createError({ statusCode: 403, statusMessage: 'Not authorized or contest not found' });
  return result;
});

import { updateContest } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';
import { updateContestSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, updateContestSchema);

  const result = await updateContest(db, slug, user.id, input);
  if (!result) throw createError({ statusCode: 403, statusMessage: 'Not authorized or contest not found' });
  return result;
});

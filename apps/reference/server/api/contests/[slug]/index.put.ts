import { updateContest } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';
import { updateContestSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug required' });
  const body = await readBody(event);

  const parsed = updateContestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const result = await updateContest(db, slug, user.id, parsed.data);
  if (!result) throw createError({ statusCode: 403, statusMessage: 'Not authorized or contest not found' });
  return result;
});

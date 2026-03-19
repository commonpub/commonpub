import { createContest } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';
import { createContestSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = createContestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createContest(db, { ...parsed.data, createdBy: user.id });
});

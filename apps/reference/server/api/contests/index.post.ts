import { createContest } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';
import { createContestSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createContestSchema);

  return createContest(db, { ...input, createdBy: user.id } as any, {
    userRole: user.role,
    contestCreationPolicy: config.instance.contestCreation ?? 'admin',
  });
});

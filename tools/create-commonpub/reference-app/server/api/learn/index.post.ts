import { createPath } from '@commonpub/server';
import type { LearningPathDetail } from '@commonpub/server';
import { createLearningPathSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<LearningPathDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createLearningPathSchema);

  return createPath(db, user.id, input);
});

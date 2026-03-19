import { listComments } from '@commonpub/server';
import type { CommentItem } from '@commonpub/server';
import { commentTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const commentsQuerySchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<CommentItem[]> => {
  const db = useDB();
  const query = parseQueryParams(event, commentsQuerySchema);

  return listComments(db, query.targetType, query.targetId);
});

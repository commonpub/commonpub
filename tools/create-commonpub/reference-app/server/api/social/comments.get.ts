import { listComments } from '@commonpub/server';
import type { CommentItem } from '@commonpub/server';
import { commentTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const commentsQuerySchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export default defineEventHandler(async (event): Promise<CommentItem[]> => {
  const db = useDB();
  const query = parseQueryParams(event, commentsQuerySchema);

  return listComments(db, query.targetType, query.targetId, query.limit, query.offset);
});

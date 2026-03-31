import { listReplies } from '@commonpub/server';
import type { HubReplyItem } from '@commonpub/server';
import { z } from 'zod';

const repliesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<{ items: HubReplyItem[]; total: number }> => {
  const db = useDB();
  const { postId } = parseParams(event, { postId: 'uuid' });
  const query = parseQueryParams(event, repliesQuerySchema);

  return listReplies(db, postId, query);
});

import { listReplies } from '@commonpub/server';
import type { HubReplyItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubReplyItem[]> => {
  const db = useDB();
  const postId = getRouterParam(event, 'postId')!;

  return listReplies(db, postId);
});

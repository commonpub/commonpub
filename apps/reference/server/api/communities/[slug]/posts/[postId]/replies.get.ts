import { listReplies } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const postId = getRouterParam(event, 'postId')!;

  return listReplies(db, postId);
});

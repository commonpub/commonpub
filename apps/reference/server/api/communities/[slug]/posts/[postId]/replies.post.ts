import { createReply } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const postId = getRouterParam(event, 'postId')!;
  const body = await readBody(event);

  return createReply(db, user.id, { postId, content: body.content, parentId: body.parentId });
});

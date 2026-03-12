import { isLiked } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const query = getQuery(event);

  const liked = await isLiked(db, user.id, query.targetType as string, query.targetId as string);
  return { liked };
});

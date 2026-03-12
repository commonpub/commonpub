import { getUserByUsername, getUserContent } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const username = getRouterParam(event, 'username')!;
  const query = getQuery(event);

  const user = await getUserByUsername(db, username);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return getUserContent(db, user.id, query.type as string | undefined);
});

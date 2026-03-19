import { getUserByUsername, followUser } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ followed: boolean }> => {
  const db = useDB();
  const user = requireAuth(event);
  const username = getRouterParam(event, 'username');

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'Username is required' });
  }

  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return followUser(db, user.id, target.id);
});

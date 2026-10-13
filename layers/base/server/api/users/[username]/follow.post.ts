import { getUserByUsername, followUser } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ followed: boolean }> => {
  requireFeature('social');
  const db = useDB();
  const user = requireAuth(event);
  const { username } = parseParams(event, { username: 'string' });
  // Hidden by the member's profile visibility: the same 404 as no account.
  await requireVisibleProfile(event, username);


  const target = await getUserByUsername(db, username);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return followUser(db, user.id, target.id);
});

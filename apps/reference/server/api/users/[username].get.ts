import { getUserByUsername } from '@commonpub/server';
import type { UserProfile } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<UserProfile> => {
  const db = useDB();
  const username = getRouterParam(event, 'username')!;

  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }
  return profile;
});

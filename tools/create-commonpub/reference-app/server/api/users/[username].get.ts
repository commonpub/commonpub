import { getUserByUsername, isFollowing } from '@commonpub/server';
import type { UserProfile } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<UserProfile & { isFollowing: boolean }> => {
  const db = useDB();
  const { username } = parseParams(event, { username: 'string' });

  const profile = await getUserByUsername(db, username);
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  // Check if current user follows this profile
  let followStatus = false;
  try {
    const auth = event.context.auth;
    if (auth?.user?.id && auth.user.id !== profile.id) {
      followStatus = await isFollowing(db, auth.user.id, profile.id);
    }
  } catch {
    // Not authenticated — default to false
  }

  return { ...profile, isFollowing: followStatus };
});

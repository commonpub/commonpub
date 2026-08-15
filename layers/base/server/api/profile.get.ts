import { getUserByUsername, getProfilePrivacySettings } from '@commonpub/server';
import type { UserProfile } from '@commonpub/server';

/**
 * The viewer's OWN profile. Owner-only, unlike `/api/users/:username`.
 *
 * `profileVisibility` is added here and NOT to `UserProfile`, because that type
 * is shared with the public user route and the federation serializer: a field
 * added to it is a field disclosed to strangers. A person's visibility setting
 * is theirs to read, not their visitors'.
 */
export type OwnProfile = UserProfile & {
  profileVisibility: 'public' | 'members' | 'private';
};

export default defineEventHandler(async (event): Promise<OwnProfile> => {
  const db = useDB();
  const user = requireAuth(event);

  const [profile, privacy] = await Promise.all([
    getUserByUsername(db, user.username),
    getProfilePrivacySettings(db, user.id),
  ]);

  if (!profile || !privacy) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  return { ...profile, profileVisibility: privacy.profileVisibility };
});

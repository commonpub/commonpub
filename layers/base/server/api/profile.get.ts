import { getUserByUsername, getProfilePrivacySettings, getOwnEmailNotificationPrefs } from '@commonpub/server';
import type { UserProfile, OwnEmailNotificationPrefs } from '@commonpub/server';

/**
 * The viewer's OWN profile. Owner-only, unlike `/api/users/:username`.
 *
 * `profileVisibility` is added here and NOT to `UserProfile`, because that type
 * is shared with the public user route and the federation serializer: a field
 * added to it is a field disclosed to strangers. A person's visibility setting
 * is theirs to read, not their visitors'.
 *
 * `emailNotifications` moved here for exactly the same reason, having been on
 * `UserProfile` and therefore public: an unauthenticated
 * `GET /api/users/:username` was returning members' digest cadence and
 * per-event toggles to anyone who asked, live on all three instances.
 */
export type OwnProfile = UserProfile & {
  profileVisibility: 'public' | 'members' | 'private';
  emailNotifications: OwnEmailNotificationPrefs | null;
};

export default defineEventHandler(async (event): Promise<OwnProfile> => {
  const db = useDB();
  const user = requireAuth(event);

  const [profile, privacy, emailNotifications] = await Promise.all([
    getUserByUsername(db, user.username),
    getProfilePrivacySettings(db, user.id),
    getOwnEmailNotificationPrefs(db, user.id),
  ]);

  if (!profile || !privacy) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  return { ...profile, profileVisibility: privacy.profileVisibility, emailNotifications };
});

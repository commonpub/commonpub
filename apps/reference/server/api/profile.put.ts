import { updateUserProfile } from '@commonpub/server';
import type { UserProfile } from '@commonpub/server';
import { updateProfileSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<UserProfile> => {
  const db = useDB();
  const user = requireAuth(event);
  const raw = await parseBody(event, updateProfileSchema);
  // Convert empty strings to undefined for URL fields (avoids <img src="">)
  const input = {
    ...raw,
    avatarUrl: raw.avatarUrl || undefined,
    bannerUrl: raw.bannerUrl || undefined,
    website: raw.website || undefined,
  };

  const profile = await updateUserProfile(db, user.id, input);

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  return profile;
});

import { updateUserProfile } from '@commonpub/server';
import type { UserProfile } from '@commonpub/server';
import { updateProfileSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<UserProfile> => {
  const db = useDB();
  const user = requireAuth(event);

  const body = await readBody(event);
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  const profile = await updateUserProfile(db, user.id, parsed.data);

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' });
  }

  return profile;
});

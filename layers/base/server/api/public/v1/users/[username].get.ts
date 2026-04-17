import { isPublicUser, toPublicUser, type PublicUserRow } from '@commonpub/server';
import { users } from '@commonpub/schema';
import { and, eq, isNull } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:users');
  const username = getRouterParam(event, 'username');
  if (!username) throw createError({ statusCode: 400, statusMessage: 'Missing username' });

  const db = useDB();
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      headline: users.headline,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      bannerUrl: users.bannerUrl,
      pronouns: users.pronouns,
      location: users.location,
      website: users.website,
      skills: users.skills,
      socialLinks: users.socialLinks,
      profileVisibility: users.profileVisibility,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt), eq(users.status, 'active')))
    .limit(1);

  if (!row || !isPublicUser(row as PublicUserRow)) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' });
  }

  return toPublicUser(row as PublicUserRow);
});

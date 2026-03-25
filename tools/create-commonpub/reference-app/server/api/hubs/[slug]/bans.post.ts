import { banUser, getHubBySlug } from '@commonpub/server';
import { banUserSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ banned: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, banUserSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return banUser(
    db,
    user.id,
    hub.id,
    input.userId,
    input.reason,
    input.expiresAt ? new Date(input.expiresAt) : undefined,
  );
});

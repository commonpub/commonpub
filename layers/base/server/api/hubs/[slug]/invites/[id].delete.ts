import { revokeInvite, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ revoked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, id } = parseParams(event, { slug: 'string', id: 'uuid' });
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const revoked = await revokeInvite(db, id, user.id, hub.id);
  if (!revoked) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to revoke invites' });
  }
  return { revoked };
});

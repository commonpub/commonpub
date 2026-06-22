import { approveJoinRequest, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ approved: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, userId } = parseParams(event, { slug: 'string', userId: 'uuid' });

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  // Permission (manageMembers) is enforced inside approveJoinRequest.
  return approveJoinRequest(db, user.id, hub.id, userId);
});

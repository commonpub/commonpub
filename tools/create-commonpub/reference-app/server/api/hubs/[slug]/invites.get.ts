import { listInvites, getHubBySlug, getMember } from '@commonpub/server';
import type { HubInviteItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubInviteItem[]> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  // Only moderators, admins, and owners can view invite lists
  const member = await getMember(db, hub.id, user.id);
  if (!member || !['moderator', 'admin', 'owner'].includes(member.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }

  return listInvites(db, hub.id);
});

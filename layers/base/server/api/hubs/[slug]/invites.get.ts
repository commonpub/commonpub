import { listInvites, getHubBySlug, getMember, hasPermission } from '@commonpub/server';
import type { HubInviteItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubInviteItem[]> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  // Invite management is admin+ (matches createInvite/revokeInvite's manageMembers).
  // Gating the list at the same level keeps moderators from seeing write controls
  // they can't use.
  const member = await getMember(db, hub.id, user.id);
  if (!member || !hasPermission(member.role, 'manageMembers')) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }

  return listInvites(db, hub.id);
});

import { listJoinRequests, getHubBySlug, getMember } from '@commonpub/server';
import type { HubMemberItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ items: HubMemberItem[]; total: number }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  // Reviewing join requests is a member-management action (admin/owner).
  const member = await getMember(db, hub.id, user.id);
  if (!member || !['admin', 'owner'].includes(member.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' });
  }

  return listJoinRequests(db, hub.id);
});

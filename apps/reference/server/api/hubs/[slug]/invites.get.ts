import { listInvites, getHubBySlug } from '@commonpub/server';
import type { HubInviteItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubInviteItem[]> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return listInvites(db, community.id);
});

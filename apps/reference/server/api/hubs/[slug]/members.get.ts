import { listMembers, getHubBySlug } from '@commonpub/server';
import type { HubMemberItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<HubMemberItem[]> => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return listMembers(db, community.id);
});

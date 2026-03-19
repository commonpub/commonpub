import { unbanUser, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ unbanned: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const userId = getRouterParam(event, 'userId')!;
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return unbanUser(db, user.id, community.id, userId);
});

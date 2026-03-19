import { joinHub, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ joined: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return joinHub(db, user.id, community.id);
});

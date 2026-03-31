import { leaveHub, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ left: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return leaveHub(db, user.id, community.id);
});

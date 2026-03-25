import { kickMember, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ kicked: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, userId } = parseParams(event, { slug: 'string', userId: 'uuid' });
  const community = await getHubBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return kickMember(db, user.id, community.id, userId);
});

import { getCommunityBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const user = getOptionalUser(event);

  const community = await getCommunityBySlug(db, slug, user?.id);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  return community;
});

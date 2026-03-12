import { changeRole, getCommunityBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const userId = getRouterParam(event, 'userId')!;
  const body = await readBody(event);
  const community = await getCommunityBySlug(db, slug);
  if (!community) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return changeRole(db, user.id, community.id, userId, body.role);
});

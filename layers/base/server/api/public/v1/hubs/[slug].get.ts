import { getHubBySlug, toPublicHub, type PublicHubRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:hubs');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const db = useDB();
  const config = useConfig();
  // No-requesterId getHubBySlug returns the real-id stub for a private hub, so a
  // read:hubs token could otherwise read a private hub's name + member/post
  // counts. Match the public directory list (listHubs excludes private): 404.
  const hub = await getHubBySlug(db, slug);
  if (!hub || (hub as { deletedAt?: Date | null }).deletedAt || hub.privacy === 'private') {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return toPublicHub(hub as unknown as PublicHubRow, config.instance.domain);
});

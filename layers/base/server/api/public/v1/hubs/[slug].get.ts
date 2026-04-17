import { getHubBySlug, toPublicHub, type PublicHubRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:hubs');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const db = useDB();
  const config = useConfig();
  const hub = await getHubBySlug(db, slug);
  if (!hub || (hub as { deletedAt?: Date | null }).deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return toPublicHub(hub as unknown as PublicHubRow, config.instance.domain);
});

import { getHubBySlug, listHubResources } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return listHubResources(db, hub.id);
});

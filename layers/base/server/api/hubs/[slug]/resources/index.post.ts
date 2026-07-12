import { getHubIdBySlug, createHubResource } from '@commonpub/server';
import { createHubResourceSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubIdBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const input = await parseBody(event, createHubResourceSchema);
  return createHubResource(db, hub.id, user.id, input);
});

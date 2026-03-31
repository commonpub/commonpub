import { updateHub, getHubBySlug } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import { updateHubSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const input = await parseBody(event, updateHubSchema);

  const updated = await updateHub(db, hub.id, user.id, input);
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to update this hub' });
  }
  return updated;
});

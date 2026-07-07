import { unshareContent, getHubBySlug } from '@commonpub/server';
import { z } from 'zod';

const unshareSchema = z.object({ contentId: z.string().uuid() });

export default defineEventHandler(async (event): Promise<{ unshared: boolean }> => {
  requireFeature('hubGovernance');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, unshareSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const ok = await unshareContent(db, user.id, hub.id, input.contentId, { asPlatformAdmin: hasPermission(event, 'admin.access') });
  if (!ok) throw createError({ statusCode: 403, statusMessage: 'Cannot unlink. You must be the sharer or a hub admin.' });
  return { unshared: true };
});

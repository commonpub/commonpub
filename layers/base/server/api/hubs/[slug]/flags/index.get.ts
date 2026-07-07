import { listHubFlags, getHubBySlug } from '@commonpub/server';
import type { HubFlagItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ items: HubFlagItem[] }> => {
  requireFeature('hubGovernance');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const status = getQuery(event).status as 'open' | 'dismissed' | 'actioned' | undefined;

  const hub = await getHubBySlug(db, slug);
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const res = await listHubFlags(db, user.id, hub.id, status ? { status } : undefined);
  if (res.error) throw createError({ statusCode: 403, statusMessage: res.error });
  return { items: res.items };
});

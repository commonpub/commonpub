import { createHubFlag, getHubBySlug } from '@commonpub/server';
import { createHubFlagSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ flagged: boolean; error?: string }> => {
  requireFeature('hubGovernance');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, createHubFlagSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const res = await createHubFlag(db, user.id, hub.id, input);
  if (!res.flagged) throw createError({ statusCode: 403, statusMessage: res.error ?? 'Cannot flag' });
  return res;
});

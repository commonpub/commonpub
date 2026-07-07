import { resolveHubFlag, getHubBySlug } from '@commonpub/server';
import { resolveHubFlagSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ resolved: boolean; error?: string }> => {
  requireFeature('hubGovernance');
  const user = requireAuth(event);
  const db = useDB();
  const { slug, flagId } = parseParams(event, { slug: 'string', flagId: 'uuid' });
  const input = await parseBody(event, resolveHubFlagSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const res = await resolveHubFlag(db, user.id, hub.id, flagId, input.status);
  if (!res.resolved) throw createError({ statusCode: 403, statusMessage: res.error ?? 'Cannot resolve flag' });
  return res;
});

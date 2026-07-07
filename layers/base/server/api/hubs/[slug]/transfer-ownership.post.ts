import { transferOwnership, getHubBySlug } from '@commonpub/server';
import { transferOwnershipSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ transferred: boolean; error?: string }> => {
  requireFeature('hubGovernance');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, transferOwnershipSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) throw createError({ statusCode: 404, statusMessage: 'Hub not found' });

  const res = await transferOwnership(db, user.id, hub.id, input.userId);
  if (!res.transferred) throw createError({ statusCode: 403, statusMessage: res.error ?? 'Cannot transfer ownership' });
  return res;
});

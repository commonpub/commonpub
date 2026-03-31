import { changeRole, getHubBySlug } from '@commonpub/server';
import { changeRoleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ changed: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug, userId } = parseParams(event, { slug: 'string', userId: 'uuid' });
  const input = await parseBody(event, changeRoleSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return changeRole(db, user.id, hub.id, userId, input.role);
});

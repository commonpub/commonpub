import { changeRole, getHubBySlug } from '@commonpub/server';
import { changeRoleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ changed: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const userId = getRouterParam(event, 'userId')!;
  const body = await readBody(event);

  const parsed = changeRoleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return changeRole(db, user.id, hub.id, userId, parsed.data.role);
});

import { banUser, getHubBySlug } from '@commonpub/server';
import { banUserSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ banned: boolean; error?: string }> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const body = await readBody(event);

  const parsed = banUserSchema.safeParse(body);
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

  return banUser(
    db,
    user.id,
    hub.id,
    parsed.data.userId,
    parsed.data.reason,
    parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
  );
});

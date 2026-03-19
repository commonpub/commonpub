import { createInvite, getHubBySlug } from '@commonpub/server';
import type { HubInviteItem } from '@commonpub/server';
import { createInviteSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubInviteItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug') as string;
  const body = await readBody(event);

  const parsed = createInviteSchema.safeParse(body);
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

  return createInvite(
    db,
    user.id,
    hub.id,
    parsed.data.maxUses,
    parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
  );
});

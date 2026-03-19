import { updateHub, getHubBySlug } from '@commonpub/server';
import type { HubDetail } from '@commonpub/server';
import { updateHubSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<HubDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const body = await readBody(event);

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const parsed = updateHubSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const updated = await updateHub(db, hub.id, user.id, parsed.data);
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to update this hub' });
  }
  return updated;
});

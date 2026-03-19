import { createModule, getPathBySlug } from '@commonpub/server';
import { createModuleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const body = await readBody(event);

  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  return createModule(db, user.id, { ...parsed.data, pathId: path.id });
});

import { createModule, getPathBySlug } from '@commonpub/server';
import { createModuleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, createModuleSchema);

  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  return createModule(db, user.id, { ...input, pathId: path.id });
});

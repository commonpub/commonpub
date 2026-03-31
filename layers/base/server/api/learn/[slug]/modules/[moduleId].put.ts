import { updateModule } from '@commonpub/server';
import { updateModuleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { moduleId } = parseParams(event, { moduleId: 'uuid' });
  const input = await parseBody(event, updateModuleSchema);

  const updated = await updateModule(db, moduleId, user.id, input);
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found or not authorized' });
  }
  return updated;
});

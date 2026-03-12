import { updateModule } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const moduleId = getRouterParam(event, 'moduleId')!;
  const body = await readBody(event);

  return updateModule(db, moduleId, user.id, body);
});

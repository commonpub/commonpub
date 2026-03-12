import { updateUserRole } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);

  return updateUserRole(db, id, body.role);
});

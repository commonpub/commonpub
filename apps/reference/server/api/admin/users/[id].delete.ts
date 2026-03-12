import { deleteUser } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  return deleteUser(db, id);
});

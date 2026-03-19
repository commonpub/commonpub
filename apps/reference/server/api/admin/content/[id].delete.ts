import { removeContent } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<void> => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  return removeContent(db, id, admin.id);
});

import { resolveReport } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);

  return resolveReport(db, id, admin.id, body.resolution);
});

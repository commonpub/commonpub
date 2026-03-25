import { resolveReport } from '@commonpub/server';
import { resolveReportSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, resolveReportSchema);

  return resolveReport(db, id, input.resolution, input.status ?? 'resolved', admin.id);
});

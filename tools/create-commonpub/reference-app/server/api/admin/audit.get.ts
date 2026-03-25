import { listAuditLogs } from '@commonpub/server';
import type { PaginatedResponse, AuditLogItem } from '@commonpub/server';
import { z } from 'zod';

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<AuditLogItem>> => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();
  const filters = parseQueryParams(event, auditQuerySchema);

  return listAuditLogs(db, filters);
});

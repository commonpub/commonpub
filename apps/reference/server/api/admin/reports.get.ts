import { listReports } from '@commonpub/server';
import type { PaginatedResponse, ReportListItem } from '@commonpub/server';
import { z } from 'zod';

const reportsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<ReportListItem>> => {
  requireAdmin(event);
  const db = useDB();
  const filters = reportsQuerySchema.parse(getQuery(event));

  return listReports(db, filters);
});

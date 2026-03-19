import { resolveReport } from '@commonpub/server';
import { resolveReportSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);

  const parsed = resolveReportSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return resolveReport(db, id, parsed.data.resolution, parsed.data.status ?? 'resolved', admin.id);
});

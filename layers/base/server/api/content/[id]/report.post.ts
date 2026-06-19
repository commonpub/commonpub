import { createReport } from '@commonpub/server';
import { createReportSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ id: string }> => {
  // NOTE: abuse reporting is a safety function and deliberately NOT gated behind the
  // `social` feature flag (it must work even where social interactions are off). (session 204)
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });

  const body = await readBody(event);
  const parsed = createReportSchema.safeParse({ ...body, targetId: id });

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  return createReport(db, user.id, parsed.data);
});

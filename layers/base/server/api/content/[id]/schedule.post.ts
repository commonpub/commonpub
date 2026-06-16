import { scheduleContent } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';
import { z } from 'zod';

const scheduleBodySchema = z.object({ scheduledAt: z.coerce.date() });

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const { scheduledAt } = await parseBody(event, scheduleBodySchema);

  if (scheduledAt.getTime() <= Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'Scheduled time must be in the future' });
  }

  const content = await scheduleContent(db, id, user.id, scheduledAt);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found, not yours, or already published' });
  }

  return content;
});

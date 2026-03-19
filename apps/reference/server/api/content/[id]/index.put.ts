import { updateContent } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';
import { updateContentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  // Validate UUID format to prevent DB errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid content ID' });
  }

  const body = await readBody(event);

  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const content = await updateContent(db, id, user.id, parsed.data);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found or not owned by you' });
  }
  return content;
});

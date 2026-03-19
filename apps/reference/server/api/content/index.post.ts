import { createContent } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';
import { createContentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = createContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createContent(db, user.id, parsed.data);
});

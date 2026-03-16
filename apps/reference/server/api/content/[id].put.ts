import { updateContent } from '@commonpub/server';
import { updateContentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);

  const parsed = updateContentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const content = await updateContent(db, id, user.id, body);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found or not owned by you' });
  }
  return content;
});

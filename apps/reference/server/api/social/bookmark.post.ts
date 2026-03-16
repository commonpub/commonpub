import { toggleBookmark } from '@commonpub/server';

const VALID_TARGET_TYPES = ['project', 'article', 'blog', 'explainer', 'learning_path'];

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  if (!body?.targetType || !VALID_TARGET_TYPES.includes(body.targetType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid target type' });
  }
  if (!body?.targetId || typeof body.targetId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid target ID' });
  }

  return toggleBookmark(db, user.id, body.targetType, body.targetId);
});

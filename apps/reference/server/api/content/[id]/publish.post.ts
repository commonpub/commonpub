import { publishContent, onContentPublished } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const id = getRouterParam(event, 'id')!;

  const content = await publishContent(db, id, user.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found or not owned by you' });
  }

  await onContentPublished(db, id, config);
  return content;
});

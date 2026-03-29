import { updateContent, onContentUpdated } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';
import { updateContentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, updateContentSchema);

  const content = await updateContent(db, id, user.id, input);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found or not owned by you' });
  }

  // Only federate updates to published content
  if (content.status === 'published') {
    await onContentUpdated(db, id, config);
  }

  return content;
});

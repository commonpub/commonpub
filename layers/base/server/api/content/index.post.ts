import { createContent } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';
import { createContentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createContentSchema);

  return createContent(db, user.id, input);
});

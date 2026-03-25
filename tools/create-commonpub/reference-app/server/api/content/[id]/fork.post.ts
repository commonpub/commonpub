import { forkContent } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  return forkContent(db, id, user.id);
});

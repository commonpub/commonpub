import { forkContent } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;

  return forkContent(db, id, user.id);
});

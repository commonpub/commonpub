import { toggleBookmark } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  return toggleBookmark(db, user.id, body.targetType, body.targetId);
});

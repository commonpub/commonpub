import { listConversations } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);

  return listConversations(db, user.id);
});

import { listConversations } from '@commonpub/server';
import type { ConversationItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ConversationItem[]> => {
  const db = useDB();
  const user = requireAuth(event);

  return listConversations(db, user.id);
});

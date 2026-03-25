import { getConversationMessages, markMessagesRead } from '@commonpub/server';
import type { MessageItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<MessageItem[]> => {
  const db = useDB();
  const user = requireAuth(event);
  const { conversationId } = parseParams(event, { conversationId: 'uuid' });

  const messages = await getConversationMessages(db, conversationId, user.id);
  await markMessagesRead(db, conversationId, user.id);

  return messages;
});

import { getConversationMessages, markMessagesRead } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  const conversationId = getRouterParam(event, 'conversationId')!;

  const messages = await getConversationMessages(db, conversationId, user.id);
  await markMessagesRead(db, conversationId, user.id);

  return messages;
});

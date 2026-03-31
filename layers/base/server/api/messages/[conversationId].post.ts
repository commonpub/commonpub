import { sendMessage } from '@commonpub/server';
import type { MessageItem } from '@commonpub/server';
import { sendMessageSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<MessageItem> => {
  const db = useDB();
  const user = requireAuth(event);
  const { conversationId } = parseParams(event, { conversationId: 'uuid' });
  const input = await parseBody(event, sendMessageSchema);

  return sendMessage(db, conversationId, user.id, input.body);
});

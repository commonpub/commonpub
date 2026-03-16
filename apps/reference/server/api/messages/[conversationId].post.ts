import { sendMessage } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = await requireAuth(event);
  const conversationId = getRouterParam(event, 'conversationId')!;
  const { body } = await readBody(event);

  return sendMessage(db, conversationId, user.id, body);
});

import { sendMessage } from '@commonpub/server';
import type { MessageItem } from '@commonpub/server';
import { sendMessageSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<MessageItem> => {
  const db = useDB();
  const user = requireAuth(event);
  const conversationId = getRouterParam(event, 'conversationId')!;
  const body = await readBody(event);

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return sendMessage(db, conversationId, user.id, parsed.data.body);
});

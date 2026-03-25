import { conversations } from '@commonpub/schema';
import { eq, and, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { conversationId } = parseParams(event, { conversationId: 'uuid' });

  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        sql`${conversations.participants} @> ${JSON.stringify([user.id])}::jsonb`,
      ),
    )
    .limit(1);

  if (!rows.length) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }

  return {
    id: rows[0]!.id,
    participants: rows[0]!.participants,
  };
});

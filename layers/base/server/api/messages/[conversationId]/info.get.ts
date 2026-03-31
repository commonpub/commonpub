import { conversations, users } from '@commonpub/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

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

  const participantIds = (rows[0]!.participants ?? []) as string[];

  // Resolve participant IDs to display names
  const participantUsers = participantIds.length > 0
    ? await db
        .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, participantIds))
    : [];

  return {
    id: rows[0]!.id,
    participants: participantUsers.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? u.username,
      avatarUrl: u.avatarUrl,
    })),
  };
});

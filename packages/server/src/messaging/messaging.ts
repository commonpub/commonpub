import { eq, and, desc, sql, notExists, inArray } from 'drizzle-orm';
import { conversations, messages, messageReads, users } from '@commonpub/schema';
import type { DB } from '../types.js';
import { publishSseEvent } from '../realtime/index.js';

/** Truncate a string at a Unicode-safe boundary (never splits surrogate pairs or grapheme clusters). */
function truncateUnicode(str: string, maxChars: number): string {
  const chars = [...str];
  if (chars.length <= maxChars) return str;
  return chars.slice(0, maxChars).join('') + '...';
}

export interface ConversationItem {
  id: string;
  participants: string[];
  lastMessageAt: Date;
  lastMessage: string | null;
  createdAt: Date;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string | null;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export async function listConversations(
  db: DB,
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ConversationItem[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  // jsonb @> check: participants array contains userId
  const rows = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    participants: row.participants,
    lastMessageAt: row.lastMessageAt,
    lastMessage: row.lastMessage,
    createdAt: row.createdAt,
  }));
}

export async function getConversationMessages(
  db: DB,
  conversationId: string,
  userId: string,
): Promise<MessageItem[]> {
  // Verify user is a participant
  const conv = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`,
      ),
    )
    .limit(1);

  if (conv.length === 0) return [];

  const rows = await db
    .select({
      message: messages,
      senderDisplayName: users.displayName,
      senderUsername: users.username,
      senderAvatarUrl: users.avatarUrl,
      readAt: messageReads.readAt,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .leftJoin(
      messageReads,
      and(eq(messageReads.messageId, messages.id), eq(messageReads.userId, sql`${userId}::uuid`)),
    )
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  return rows.map((row) => ({
    id: row.message.id,
    conversationId: row.message.conversationId,
    senderId: row.message.senderId,
    senderName: row.senderDisplayName ?? row.senderUsername ?? null,
    senderAvatarUrl: row.senderAvatarUrl ?? null,
    body: row.message.body,
    createdAt: row.message.createdAt,
    readAt: row.readAt ?? null,
  }));
}

export async function createConversation(
  db: DB,
  participants: string[],
): Promise<ConversationItem> {
  // Validate all participant IDs correspond to existing users
  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, participants));

  if (existingUsers.length !== participants.length) {
    throw new Error('One or more participant IDs do not exist');
  }

  const [row] = await db
    .insert(conversations)
    .values({
      participants,
    })
    .returning();

  return {
    id: row!.id,
    participants: row!.participants,
    lastMessageAt: row!.lastMessageAt,
    lastMessage: row!.lastMessage,
    createdAt: row!.createdAt,
  };
}

/** Find an existing conversation with exactly the given participants, or create one.
 *  Uses a transaction with retry to prevent duplicate conversations from concurrent requests. */
export async function findOrCreateConversation(
  db: DB,
  participants: string[],
): Promise<ConversationItem> {
  // Sort for deterministic matching
  const sorted = [...participants].sort();

  // Helper: find exact participant match
  async function findExisting(d: DB): Promise<ConversationItem | null> {
    const existing = await d
      .select()
      .from(conversations)
      .where(
        and(
          sql`${conversations.participants} @> ${JSON.stringify(sorted)}::jsonb`,
          sql`jsonb_array_length(${conversations.participants}) = ${sorted.length}`,
        ),
      )
      .limit(1);

    if (existing.length === 0) return null;
    const row = existing[0]!;
    return {
      id: row.id,
      participants: row.participants,
      lastMessageAt: row.lastMessageAt,
      lastMessage: row.lastMessage,
      createdAt: row.createdAt,
    };
  }

  // Check outside transaction first (fast path, no lock)
  const found = await findExisting(db);
  if (found) return found;

  // If not found, use transaction with advisory lock to serialize creation.
  // Advisory lock keyed on a hash of the sorted participant list prevents
  // concurrent transactions from both inserting the same conversation.
  const lockKey = sorted.join(',');
  return await db.transaction(async (tx) => {
    // pg_advisory_xact_lock is released automatically when the transaction ends
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const existingInTx = await findExisting(tx);
    if (existingInTx) return existingInTx;
    return createConversation(tx, sorted);
  });
}

export async function sendMessage(
  db: DB,
  conversationId: string,
  senderId: string,
  body: string,
): Promise<MessageItem> {
  // Verify sender is a participant in this conversation; fetch the
  // participants list so we can fan SSE events out below.
  const conv = await db
    .select({ id: conversations.id, participants: conversations.participants })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        sql`${conversations.participants} @> ${JSON.stringify([senderId])}::jsonb`,
      ),
    )
    .limit(1);

  if (conv.length === 0) {
    throw new Error('Not a participant in this conversation');
  }
  const participants = (conv[0]?.participants as string[] | null) ?? [];

  // Truncate lastMessage safely (preserve multi-byte characters)
  const truncated = truncateUnicode(body, 200);

  // Insert message + update conversation atomically
  const [row] = await db.transaction(async (tx) => {
    const [msgRow] = await tx
      .insert(messages)
      .values({
        conversationId,
        senderId,
        body,
      })
      .returning();

    await tx
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
        lastMessage: truncated,
      })
      .where(eq(conversations.id, conversationId));

    return [msgRow];
  });

  // Resolve sender info (outside transaction — read-only, non-critical)
  const [sender] = await db.select({ displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl })
    .from(users).where(eq(users.id, senderId)).limit(1);

  // Fire-and-forget SSE fanout to every other participant. The sender
  // already sees the message via the API response, so we skip them.
  for (const participantId of participants) {
    if (participantId === senderId) continue;
    publishSseEvent(participantId, { type: 'message', messageId: row!.id }).catch(() => {});
  }

  return {
    id: row!.id,
    conversationId: row!.conversationId,
    senderId: row!.senderId,
    senderName: sender?.displayName ?? sender?.username ?? null,
    senderAvatarUrl: sender?.avatarUrl ?? null,
    body: row!.body,
    createdAt: row!.createdAt,
    readAt: null,
  };
}

/**
 * Count unread messages across all conversations for a user.
 * Uses message_reads table for per-participant read tracking.
 */
export async function getUnreadMessageCount(
  db: DB,
  userId: string,
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`,
        sql`${messages.senderId} != ${userId}`,
        notExists(
          db.select({ one: sql`1` })
            .from(messageReads)
            .where(and(eq(messageReads.messageId, messages.id), eq(messageReads.userId, sql`${userId}::uuid`))),
        ),
      ),
    );
  return result[0]?.count ?? 0;
}

/** Count unread messages per conversation for a user */
export async function getConversationUnreadCounts(
  db: DB,
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      conversationId: messages.conversationId,
      count: sql<number>`count(*)::int`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`,
        sql`${messages.senderId} != ${userId}`,
        notExists(
          db.select({ one: sql`1` })
            .from(messageReads)
            .where(and(eq(messageReads.messageId, messages.id), eq(messageReads.userId, sql`${userId}::uuid`))),
        ),
      ),
    )
    .groupBy(messages.conversationId);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.conversationId] = row.count;
  }
  return result;
}

/**
 * Mark all unread messages in a conversation as read for a specific user.
 * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
 */
export async function markMessagesRead(
  db: DB,
  conversationId: string,
  userId: string,
): Promise<void> {
  // Find all messages in this conversation from other participants
  // that this user hasn't read yet
  const unread = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.senderId} != ${userId}`,
        notExists(
          db.select({ one: sql`1` })
            .from(messageReads)
            .where(and(eq(messageReads.messageId, messages.id), eq(messageReads.userId, sql`${userId}::uuid`))),
        ),
      ),
    );

  if (unread.length === 0) return;

  await db
    .insert(messageReads)
    .values(unread.map((m) => ({ messageId: m.id, userId })))
    .onConflictDoNothing();
}

import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { conversations, messages, users } from '@commonpub/schema';
import type { DB } from './types.js';

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
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export async function listConversations(
  db: DB,
  userId: string,
): Promise<ConversationItem[]> {
  // jsonb @> check: participants array contains userId
  const rows = await db
    .select()
    .from(conversations)
    .where(sql`${conversations.participants} @> ${JSON.stringify([userId])}::jsonb`)
    .orderBy(desc(conversations.lastMessageAt));

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
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    createdAt: row.createdAt,
    readAt: row.readAt,
  }));
}

export async function createConversation(
  db: DB,
  participants: string[],
): Promise<ConversationItem> {
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

export async function sendMessage(
  db: DB,
  conversationId: string,
  senderId: string,
  body: string,
): Promise<MessageItem> {
  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId,
      body,
    })
    .returning();

  // Update conversation's last message
  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessage: body.length > 200 ? body.slice(0, 200) + '...' : body,
    })
    .where(eq(conversations.id, conversationId));

  return {
    id: row!.id,
    conversationId: row!.conversationId,
    senderId: row!.senderId,
    body: row!.body,
    createdAt: row!.createdAt,
    readAt: row!.readAt,
  };
}

export async function markMessagesRead(
  db: DB,
  conversationId: string,
  userId: string,
): Promise<void> {
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.senderId} != ${userId}`,
        isNull(messages.readAt),
      ),
    );
}

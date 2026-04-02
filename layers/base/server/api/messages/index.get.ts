import { listConversations, getConversationUnreadCounts } from '@commonpub/server';
import { users } from '@commonpub/schema';
import { inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);

  const [conversationList, unreadCounts] = await Promise.all([
    listConversations(db, user.id),
    getConversationUnreadCounts(db, user.id),
  ]);

  // Collect all unique participant IDs
  const allIds = new Set<string>();
  for (const conv of conversationList) {
    for (const id of (conv.participants ?? [])) {
      allIds.add(id);
    }
  }

  // Resolve IDs to user profiles
  const userMap = new Map<string, { username: string; displayName: string | null; avatarUrl: string | null }>();
  if (allIds.size > 0) {
    const resolved = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, [...allIds]));
    for (const u of resolved) {
      userMap.set(u.id, { username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl });
    }
  }

  // Replace participant IDs with resolved user objects, include unread count
  return conversationList.map((conv) => ({
    ...conv,
    unreadCount: unreadCounts[conv.id] ?? 0,
    participants: (conv.participants ?? []).map((id: string) => {
      const u = userMap.get(id);
      return u ? { username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl } : { username: id, displayName: null, avatarUrl: null };
    }),
  }));
});

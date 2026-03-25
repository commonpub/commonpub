import { findOrCreateConversation } from '@commonpub/server';
import { users } from '@commonpub/schema';
import { and, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

// Accept either UUIDs or usernames — resolve usernames to IDs server-side
const createConversationBodySchema = z.object({
  participants: z.array(z.string().min(1)).min(1).max(50),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const input = await parseBody(event, createConversationBodySchema);

  // Separate UUIDs from usernames, deduplicating each
  const uuidSet = new Set<string>();
  const usernameSet = new Set<string>();
  for (const p of input.participants) {
    if (UUID_REGEX.test(p)) {
      uuidSet.add(p);
    } else {
      usernameSet.add(p);
    }
  }

  const uuids = [...uuidSet];
  const usernames = [...usernameSet];

  // Resolve usernames to UUIDs (exclude soft-deleted users)
  if (usernames.length > 0) {
    const resolved = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.username, usernames), isNull(users.deletedAt)));

    if (resolved.length !== usernames.length) {
      throw createError({ statusCode: 400, statusMessage: 'One or more usernames not found' });
    }
    uuids.push(...resolved.map((r) => r.id));
  }

  // Ensure current user is included
  if (!uuids.includes(user.id)) {
    uuids.push(user.id);
  }

  // Deduplicate (a username could resolve to a UUID already in the list)
  const participants = [...new Set(uuids)];

  if (participants.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'A conversation requires at least one other participant' });
  }

  return findOrCreateConversation(db, participants);
});

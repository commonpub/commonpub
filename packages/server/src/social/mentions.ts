import { inArray } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';

const MENTION_REGEX = /(?:^|[\s(])@([a-zA-Z0-9_-]{1,39})(?=[\s,.!?;:)\]|]|$)/g;

/**
 * Extract @username mentions from text.
 * Returns a deduplicated array of usernames (without the @ prefix).
 */
export function extractMentions(text: string): string[] {
  const matches = text.matchAll(MENTION_REGEX);
  const usernames = new Set<string>();
  for (const match of matches) {
    usernames.add(match[1]!.toLowerCase());
  }
  return [...usernames];
}

/**
 * Resolve usernames to user IDs.
 * Returns a Map of lowercase username -> userId for existing users.
 */
export async function resolveUsernames(
  db: DB,
  usernames: string[],
): Promise<Map<string, string>> {
  if (usernames.length === 0) return new Map();

  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, usernames));

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.username.toLowerCase(), row.id);
  }
  return map;
}

/**
 * Internal parsing/lookup primitives shared across inbox handlers.
 *
 * These helpers were extracted from inboxHandlers.ts (audit session 204) to remove
 * repeated copy-paste of the UUID regex, the local-host guard, last-path-segment
 * extraction, the `/hubs/{slug}/posts/{postId}` URI match, and the
 * outbound-Announce-by-payload-id lookup. They are intentionally NOT re-exported
 * from the package barrel — they are private to the federation module.
 */
import { and, eq, sql } from 'drizzle-orm';
import { activities } from '@commonpub/schema';
import type { DB } from '../types.js';

/** Canonical UUID v4-ish matcher used to distinguish content/post ids from slugs. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `uri` parses as a URL whose hostname is exactly `domain` (our instance).
 * Returns false for unparseable input instead of throwing.
 */
export function isLocalHost(uri: string, domain: string): boolean {
  try {
    return new URL(uri).hostname === domain;
  } catch {
    return false;
  }
}

/**
 * The last non-empty path segment of `uri`, or null if it doesn't parse / has no path.
 */
export function lastPathSegment(uri: string): string | null {
  try {
    const segments = new URL(uri).pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Match the local hub-post Note URI shape `/hubs/{slug}/posts/{postId}` where
 * `postId` is a UUID. Returns the slug + postId, or null if the URI doesn't match
 * (unparseable, wrong shape, or non-UUID post id).
 */
export function matchHubPostUri(uri: string): { slug: string; postId: string } | null {
  try {
    const segments = new URL(uri).pathname.split('/').filter(Boolean);
    if (segments.length >= 4 && segments[0] === 'hubs' && segments[2] === 'posts') {
      const postId = segments[3]!;
      if (UUID_RE.test(postId)) {
        return { slug: segments[1]!, postId };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Look up an outbound Announce activity whose payload `id` equals `payloadId`, returning
 * the wrapped object's URI (the Note that was announced) or null. Used to resolve a
 * Like/Undo(Like) that targets the Announce activity itself rather than the Note.
 */
export async function findAnnouncedObjectUri(db: DB, payloadId: string): Promise<string | null> {
  const [announceActivity] = await db
    .select({ objectUri: activities.objectUri })
    .from(activities)
    .where(
      and(
        eq(activities.type, 'Announce'),
        eq(activities.direction, 'outbound'),
        sql`${activities.payload}->>'id' = ${payloadId}`,
      ),
    )
    .limit(1);
  return announceActivity?.objectUri ?? null;
}

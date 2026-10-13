/**
 * Who may see a member's profile (session 261).
 *
 * `users.profile_visibility` is set on the Privacy settings page, which promises:
 *   public   anyone, including people who are not signed in
 *   members  only people signed in to this site
 *   private  only the member
 * Until session 261 only the sitemap, the member directory, the metrics and the
 * public API read it; the profile itself, its follower lists and site search did
 * not. Every read of a profile now goes through these two, which must agree: the
 * predicate for one profile, the SQL condition for lists of people. A test pins
 * them against each other for every viewer.
 *
 * It is an ALLOW-list: any value the enum does not name is hidden, never shown.
 * The member always sees their own profile.
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { users } from '@commonpub/schema';
import type { DB } from '../types.js';

export interface ProfileGateTarget {
  id: string;
  profileVisibility: string | null | undefined;
}

/** May `viewerId` (null or undefined when signed out) see this member's profile? */
export function canViewProfile(target: ProfileGateTarget, viewerId: string | null | undefined): boolean {
  if (viewerId && viewerId === target.id) return true;
  const v = target.profileVisibility;
  if (v === 'public') return true;
  if (v === 'members') return !!viewerId;
  return false;
}

/** The same rule as a condition on `users`, for any query that lists people. */
export function profileVisibleTo(viewerId: string | null | undefined): SQL {
  if (!viewerId) return eq(users.profileVisibility, 'public');
  return or(
    eq(users.profileVisibility, 'public'),
    eq(users.profileVisibility, 'members'),
    eq(users.id, viewerId),
  )!;
}

/** The two facts the gate needs for one username (deleted accounts excluded). */
export async function findProfileGate(
  db: DB,
  username: string,
): Promise<{ id: string; profileVisibility: string } | null> {
  const [row] = await db
    .select({ id: users.id, profileVisibility: users.profileVisibility })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
  return row ?? null;
}

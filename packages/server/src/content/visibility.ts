import { and, eq, isNull, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';

/**
 * Shared read-visibility predicate for `content_items` (P-1 security —
 * docs/plans/content-privacy-enforcement.md).
 *
 * An item is readable iff it is the requester's own work (any status/visibility) OR it is
 * live-public (`status='published' AND visibility='public'`). Soft-deleted rows are always
 * excluded. This mirrors the three already-safe paths (resolveContentQuery,
 * content-ap.ts middleware, public/v1) and MUST be composed into every non-owner content
 * read that isn't already admin/`content.moderate`-gated.
 *
 * `members` and `private` are author-only by design: no code links content to a hub for a
 * "hub members see members-only content" grant, so do NOT add a "logged-in users see
 * members" branch — it would widen exposure beyond every current safe path.
 */
export function visibleContentWhere(requesterId?: string): SQL {
  const livePublic = and(
    eq(contentItems.status, 'published'),
    eq(contentItems.visibility, 'public'),
  )!;
  const gate = requesterId
    ? or(livePublic, eq(contentItems.authorId, requesterId))!
    : livePublic;
  return and(isNull(contentItems.deletedAt), gate)!;
}

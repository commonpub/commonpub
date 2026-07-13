import { eq } from 'drizzle-orm';
import { contests, contestEmailCopySchema } from '@commonpub/schema';
import type { ContestEmailCopy } from '@commonpub/schema';
import type { DB } from '../types.js';

// Per-contest email copy override (session 232). An organizer customizes the
// subject + plain-text intro of the two contest participation emails; the value
// is stored in `contests.email_copy` and re-validated here on read (defense in
// depth, mirroring getEmailBranding) so a template always receives a safe shape.
// Whether the override is APPLIED on a send is gated by the `contestEmailEditor`
// feature flag at the call site, not here — this only parses/loads it.

/**
 * Re-validate a stored per-contest email copy override with the write-side schema.
 * Returns `{}` for null/invalid input so each template field falls back to its
 * built-in default.
 */
export function parseContestEmailCopy(raw: unknown): ContestEmailCopy {
  if (!raw) return {};
  const parsed = contestEmailCopySchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/**
 * Load + validate a contest's email copy override by id. `{}` when unset/invalid.
 * Callers that already hold the contest row should pass `contest.emailCopy` to
 * `parseContestEmailCopy` directly instead of paying this extra round-trip.
 */
export async function getContestEmailCopy(db: DB, contestId: string): Promise<ContestEmailCopy> {
  const [row] = await db
    .select({ emailCopy: contests.emailCopy })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);
  return parseContestEmailCopy(row?.emailCopy);
}

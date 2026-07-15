import { eq } from 'drizzle-orm';
import { contests, contestEmailCopySchema } from '@commonpub/schema';
import type { ContestEmailCopy, ContestEmailCopyField } from '@commonpub/schema';
import type { DB } from '../types.js';
import { renderEmailBlocks } from '../emailBlocks.js';

/** The shape a contest email template consumes: subject/intro plus a pre-rendered,
 *  email-safe block body (html + text). Mirrors infra's ContestEmailCopyOverride. */
export interface ContestEmailCopyRendered {
  subject?: string;
  intro?: string;
  bodyHtml?: string;
  bodyText?: string;
}

/**
 * Transform a stored per-template copy field ({subject, intro, bodyBlocks}) into
 * the shape an email template consumes ({subject, intro, bodyHtml, bodyText}),
 * rendering the block body to email-safe HTML with the recipient's `{token}`
 * values. Returns undefined when the field is absent, so the template falls back
 * to its built-in default. An empty block body yields no bodyHtml/bodyText, so
 * the legacy `intro` (or default) still applies.
 */
export function buildContestEmailCopyOverride(
  field: ContestEmailCopyField | undefined,
  opts?: { tokens?: Record<string, string>; accent?: string },
): ContestEmailCopyRendered | undefined {
  if (!field) return undefined;
  const body = renderEmailBlocks(field.bodyBlocks, opts);
  return {
    subject: field.subject,
    intro: field.intro,
    bodyHtml: body.html || undefined,
    bodyText: body.text || undefined,
  };
}

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

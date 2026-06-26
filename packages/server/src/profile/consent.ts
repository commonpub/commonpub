import { eq, and, desc } from 'drizzle-orm';
import { users, userConsents } from '@commonpub/schema';
import type { DB } from '../types.js';

export type ConsentKind = 'terms' | 'code_of_conduct' | 'privacy' | 'cookies';

export interface RecordConsentInput {
  userId: string;
  kind: ConsentKind;
  /** The document version accepted (e.g. `config.instance.termsVersion`). */
  version: string;
  /** Optional sha-256 of the rendered document text (integrity snapshot). */
  documentHash?: string;
  /** Best-effort client IP captured at acceptance. */
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Record a user's consent to a site-wide document (GDPR, session 227). Appends an
 * immutable `user_consents` audit row; for `kind:'terms'` it also updates the
 * denormalized `users.acceptedTermsAt/Version` (the "current acceptance" used by a
 * future re-acceptance gate, avoiding a join on the hot path). Mirrors the
 * contest-scoped `contest_agreement_acceptances` pattern at instance scope.
 *
 * Best-effort by design: the caller (signup hook) swallows failures so a consent
 * write can never break registration. Account deletion erases these rows via the
 * `user_consents.user_id` cascade.
 */
export async function recordConsent(db: DB, input: RecordConsentInput): Promise<void> {
  // Dedup the AUDIT row: if the user's latest consent of this kind already records
  // this exact version, skip the insert (re-clicking "accept" for the same version
  // shouldn't append unbounded `user_consents` rows). A genuine re-acceptance (new
  // version) always differs, so it records.
  const [latest] = await db
    .select({ version: userConsents.version })
    .from(userConsents)
    .where(and(eq(userConsents.userId, input.userId), eq(userConsents.kind, input.kind)))
    .orderBy(desc(userConsents.acceptedAt))
    .limit(1);
  const isDuplicate = latest?.version === input.version;

  if (!isDuplicate) {
    await db.insert(userConsents).values({
      userId: input.userId,
      kind: input.kind,
      version: input.version,
      documentHash: input.documentHash ?? null,
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  }

  // Always keep the denormalized current-acceptance in sync for terms (even on a
  // duplicate click) — a single in-place UPDATE, no row growth — so the
  // re-acceptance gate reliably clears regardless of column drift.
  if (input.kind === 'terms') {
    await db
      .update(users)
      .set({ acceptedTermsAt: new Date(), acceptedTermsVersion: input.version })
      .where(eq(users.id, input.userId));
  }
}

/**
 * Whether a user must re-accept the Terms (GDPR Phase 2). True only when the
 * `requireTermsAcceptance` feature is enabled AND the user's last-accepted terms
 * version differs from the current instance `termsVersion` (including never having
 * accepted). The route exposes this so the client interstitial doesn't need to see
 * the user's stored version or the instance version.
 *
 * NOTE: the comparison is an exact string `!==` with no ordering — `termsVersion`
 * is an OPAQUE token. Always bump it FORWARD on a material terms change and never
 * reformat it (e.g. '1' → '1.0'), or every user gets re-prompted for an unchanged
 * document. A rollback to an older string also re-prompts (harmless).
 */
export async function needsTermsReacceptance(
  db: DB,
  userId: string,
  opts: { enabled: boolean; termsVersion: string },
): Promise<boolean> {
  if (!opts.enabled) return false;
  const [row] = await db
    .select({ version: users.acceptedTermsVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return false;
  return row.version !== opts.termsVersion;
}

import { eq } from 'drizzle-orm';
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
  await db.insert(userConsents).values({
    userId: input.userId,
    kind: input.kind,
    version: input.version,
    documentHash: input.documentHash ?? null,
    ipAddress: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });

  if (input.kind === 'terms') {
    await db
      .update(users)
      .set({ acceptedTermsAt: new Date(), acceptedTermsVersion: input.version })
      .where(eq(users.id, input.userId));
  }
}

/**
 * GET /api/consent/purposes/history — the viewer's own sharing-consent history
 * (plan section 6.8).
 *
 * Every row, including superseded ones, newest first. The point of the table is
 * that a person can see what they agreed to and WHEN, against the disclosure
 * they were actually shown, which is what `scopeSnapshot` preserves. A history
 * that only showed the current answer would be a state readout, not a record.
 *
 * Deliberately NOT part of the card payload from `/api/consent/purposes`: that
 * payload is the consent-token surface (its digest is what a grant binds to)
 * and it is fetched on every visit to /settings/privacy, while this grows with
 * every click a person has ever made.
 *
 * `ipAddress` and `userAgent` are NOT returned. They are evidence of the act,
 * not information the acting user needs on a settings screen, and they already
 * reach the subject through the DSAR export, which is the surface built for
 * handing someone everything held about them.
 */
import { listPurposeConsentHistory } from '@commonpub/server';

/** One row of the history table. Mirrors `ConsentHistoryRowDto` in `pages/settings/privacy.vue`. */
export interface ConsentHistoryRow {
  id: string;
  purpose: string;
  /** 'granted' | 'revoked'. Widened to string because the column is a varchar the DB could hold anything in. */
  state: string;
  /** ISO 8601. Never a locale string: an SSR-formatted date mismatches on hydration in production only. */
  actedAt: string;
  policyVersion: string;
  scopeDigest: string;
  source: string | null;
  scopeSnapshot: {
    purposeLabel: string;
    offSummary: string;
    onSummary: string;
    recipients: Array<{ id: string; name: string; relationship: string }>;
    dataClasses: string[];
    aggregatableFieldKeys: string[];
    policyVersion: string;
  } | null;
}

export interface ConsentHistoryPayload {
  history: ConsentHistoryRow[];
}

export default defineEventHandler(async (event): Promise<ConsentHistoryPayload> => {
  requireFeature('dataSharingConsents');
  const user = requireAuth(event);
  const db = useDB();

  const rows = await listPurposeConsentHistory(db, user.id);
  return {
    history: rows.map((row) => ({
      id: row.id,
      purpose: row.purpose,
      state: row.state,
      actedAt: row.actedAt.toISOString(),
      policyVersion: row.policyVersion,
      scopeDigest: row.scopeDigest,
      source: row.source,
      scopeSnapshot: row.scopeSnapshot ?? null,
    })),
  };
});

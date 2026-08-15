/**
 * GET /api/consent/purposes — the sharing-consent cards for the logged-in user
 * (plan section 6.6).
 *
 * The server owns every decision, exactly like `/api/consent/status`: which
 * purposes are offerable at all, what copy describes each one, who the
 * recipients are, whether the user's stored answer still authorises anything,
 * and whether a stale grant needs re-confirming. The client renders what it is
 * given and computes nothing. That matters here more than on a normal read
 * route, because the digest returned by this endpoint is the token the PUT
 * binds a grant to: a client that derived it itself could grant against a
 * disclosure it never displayed.
 *
 * NOT a cookie surface. This feature introduces zero new cookies and does not
 * touch `useCookieConsent`, `consentInputSchema` or `POST /api/consent`
 * (plan sections 6.1 and 14.4). Cookie consent answers an ePrivacy question
 * about an anonymous visitor's device; this answers a GDPR Art. 6(1)(a)
 * question about a logged-in person's submitted data.
 *
 * This module also exports the payload builder and the scope resolver, because
 * `purposes.put.ts` has to return the SAME full purpose list inside its 409
 * SCOPE_CHANGED body. Two hand-written copies of one payload shape drift, and a
 * consent card that disagrees with the card the 409 replaces it with is the
 * worst possible place for that drift to land.
 */
import type { CommonPubConfig } from '@commonpub/config';
import {
  PROCESSING_PURPOSE_SPECS,
  type DB,
  type PurposeScope,
  currentPurposeScope,
  deferredProcessingPurposes,
  effectiveDataSharingDocument,
  effectivePersonaSchema,
  getPurposeConsentState,
  renderPurposeOnSummary,
} from '@commonpub/server';

/**
 * The purpose id union, derived from a value `@commonpub/server` already
 * exports rather than imported from `@commonpub/persona`.
 *
 * `@commonpub/persona` is deliberately NOT a dependency of `@commonpub/layer`
 * (plan 14.3 makes the layer a consumer of `@commonpub/server`, and a published
 * layer that imported the pure package directly would need it added to every
 * fork's install). Deriving the union off `PurposeScope` keeps the boundary
 * intact and cannot drift, because it IS the server's own type.
 */
export type ConsentPurposeId = PurposeScope['offerablePurposes'][number];

/** A named recipient, as rendered on a consent card and on `/privacy`. */
export interface ConsentPurposeRecipient {
  id: string;
  name: string;
  relationship: 'processor' | 'joint_controller' | 'independent_controller';
  /** Required by `dataRecipientSchema`: you cannot disclose to a party with no policy to link. */
  privacyPolicyUrl: string;
}

/** One card on `/settings/privacy`. Every string here comes from the registry. */
export interface ConsentPurposeCard {
  id: ConsentPurposeId;
  label: string;
  /** What is true while the toggle is OFF. The client renders this FIRST. */
  offSummary: string;
  /** What starts happening if it is turned on. */
  onSummary: string;
  /** Only the recipients THIS purpose discloses to. */
  recipients: ConsentPurposeRecipient[];
  revocationEffect: string;
  legalBasis: 'consent';
  /**
   * Renamed from `kept_on_your_profile` when profile visibility inverted: a
   * member's answers are private unless the operator opted a field in, so most
   * of them are not on a profile at all and the old token named a place the
   * data is not. The literal is pinned to the registry value on purpose, so a
   * registry rename is a typecheck failure here rather than a silent token the
   * client cannot map.
   */
  answersAfterRevocation: 'kept_in_your_account';
  /** `'absent'` means never acted on, which is not a stored "no". */
  state: 'granted' | 'revoked' | 'absent';
  /** True only for a stale GRANT. A revocation is never re-asked automatically. */
  needsReconfirmation: boolean;
  /** ISO 8601, or null when the user has never acted. Rendered on the client's clock. */
  actedAt: string | null;
}

/**
 * A registered purpose this instance is NOT offering.
 *
 * Carried so a page that already shows a sharing section can SAY so. A member
 * reading a heading called "Sharing choices" with one switch under it cannot
 * tell whether the other purpose was never built or is quietly on. The list is
 * derived from the registry minus the offered set, so the sentence cannot
 * outlive the deferral.
 *
 * It is NOT an instruction to render anything. When `purposes` is empty this
 * list is the whole registry, and a surface that rendered it then would be
 * announcing recruiters to an instance that has none (plan R2.3).
 */
export interface DeferredConsentPurpose {
  id: string;
  label: string;
}

export interface ConsentPurposesPayload {
  /** The digest a subsequent PUT must echo back. */
  scopeDigest: string;
  policyVersion: string;
  /** Offerable purposes only, in registry order. */
  purposes: ConsentPurposeCard[];
  /** Registered but not offered here. Rendered as a sentence, never as a toggle. */
  deferredPurposes: DeferredConsentPurpose[];
  /**
   * The k-anonymity floors in force, so the page can state them without
   * re-deriving them and without a second endpoint.
   */
  minBucket: number;
  minPopulation: number;
}

/**
 * The live scope, resolved through the persona REGISTRY rather than the config
 * file alone.
 *
 * Passing the registry resolver is load bearing and easy to forget. Without it
 * the digest is computed over the config-file sections while the analytics join
 * counts the DB-resolved ones, so every grant made here would be stale the
 * moment an operator saved a schema override. That fails closed (a mismatched
 * digest authorises nothing) but it would silently make consent unrecordable.
 *
 * The `dataSharing` resolver is load bearing for the same reason and in the same
 * way. Recipients are the file list UNION the ones an operator added through
 * `/admin/data-sharing`, and the directory honours both when it resolves a key's
 * binding. A digest computed over the file half alone would let a
 * database-declared recipient receive a member's data on a grant given before
 * that recipient was ever named to them, and it would disagree with the digest
 * the directory's own consent join binds, so the directory would return nobody.
 */
export function resolvePurposeScope(db: DB, config: CommonPubConfig): Promise<PurposeScope> {
  return currentPurposeScope(db, config, {
    sections: async () => (await effectivePersonaSchema(db, config)).sections,
    dataSharing: effectiveDataSharingDocument,
  });
}

/**
 * Build the card list for one user against an already-resolved scope.
 *
 * Takes the scope rather than resolving it so the PUT route can reuse the exact
 * scope it just refused a write against: recomputing would re-read the registry
 * and could return a THIRD digest, which would make the 409 body describe a
 * scope the client is not being asked to confirm.
 */
export async function buildConsentPurposesPayload(
  db: DB,
  userId: string,
  scope: PurposeScope,
): Promise<ConsentPurposesPayload> {
  const entries = await getPurposeConsentState(db, userId, {
    scopeDigest: scope.digest,
    // Offerable only. A purpose nobody can act on is not a question, so it is
    // absent from this payload entirely rather than present and disabled
    // (plan 6.10; the same reasoning as Appendix B9's structural zero).
    purposes: scope.offerablePurposes,
  });
  const byPurpose = new Map(entries.map((e) => [e.purpose, e]));

  const purposes: ConsentPurposeCard[] = scope.offerablePurposes.map((id) => {
    const spec = PROCESSING_PURPOSE_SPECS[id];
    const entry = byPurpose.get(id);
    return {
      id,
      label: spec.label,
      offSummary: spec.offSummary,
      // Rendered against the floors in force. The registry carries a TEMPLATE,
      // not a finished sentence, so a card cannot promise "at least five people"
      // on an instance whose SQL floor is 25.
      onSummary: renderPurposeOnSummary(id, scope),
      recipients: recipientsForPurpose(scope, id),
      revocationEffect: spec.revocationEffect,
      legalBasis: spec.legalBasis,
      answersAfterRevocation: spec.answersAfterRevocation,
      state: entry?.state ?? 'absent',
      needsReconfirmation: entry?.needsReconfirmation ?? false,
      // ISO, never a locale string: the server's timezone is not the reader's,
      // and a server-rendered local date is the SSR hydration mismatch class.
      actedAt: entry?.actedAt ? entry.actedAt.toISOString() : null,
    };
  });

  return {
    scopeDigest: scope.digest,
    policyVersion: scope.policyVersion,
    purposes,
    // Derived from what this instance can ACTUALLY offer, not from the release's
    // offered list. `OFFERED_PROCESSING_PURPOSES` names both surviving purposes
    // and both require a declared recipient, so on an instance that has named
    // none this list is BOTH of them and `purposes` is empty. A client seeing
    // that must render no sharing section at all rather than a list of things
    // that do not happen: "recruiter sharing is off" still teaches a makerspace
    // member that recruiters are in this software (plan R2.3).
    deferredPurposes: deferredProcessingPurposes(scope.offerablePurposes).map((d) => ({
      id: d.purpose,
      label: d.label,
    })),
    minBucket: scope.minBucket,
    minPopulation: scope.minPopulation,
  };
}

/**
 * The recipients one purpose actually discloses to.
 *
 * A sponsor named for `sponsor_sharing` has nothing to do with an analytics
 * grant, and listing them on that card would misstate the disclosure. This
 * matches what `buildPurposeScopeSnapshot` records, so the card and the stored
 * evidence of what was shown cannot disagree.
 */
function recipientsForPurpose(scope: PurposeScope, id: ConsentPurposeId): ConsentPurposeRecipient[] {
  return scope.recipients
    .filter((r) => r.purposes.includes(id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      relationship: r.relationship,
      privacyPolicyUrl: r.privacyPolicyUrl,
    }));
}

export default defineEventHandler(async (event): Promise<ConsentPurposesPayload> => {
  requireFeature('dataSharingConsents');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const scope = await resolvePurposeScope(db, config);
  return await buildConsentPurposesPayload(db, user.id, scope);
});
